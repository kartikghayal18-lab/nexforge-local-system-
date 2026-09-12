//! Cryptography primitives for the local encrypted vault.
//!
//! Master-password based key derivation uses Argon2id (memory-hard, side-channel
//! resistant). The derived 256-bit key is used with AES-256-GCM (authenticated
//! encryption) to encrypt every sensitive field before it ever reaches SQLite.
//!
//! Nothing in this file logs, prints, or otherwise surfaces plaintext secret
//! values or the master password. The derived key only ever lives in process
//! memory (behind a Zeroizing wrapper) while the vault is unlocked, and is
//! dropped (zeroized) on lock.

use aes_gcm::aead::{Aead, KeyInit, OsRng as AesOsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::password_hash::SaltString;
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rand::RngCore;
use thiserror::Error;
use zeroize::Zeroizing;

pub const KEY_LEN: usize = 32; // AES-256
pub const NONCE_LEN: usize = 12; // AES-GCM standard nonce size

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("failed to derive key")]
    Derivation,
    #[error("encryption failed")]
    Encryption,
    #[error("decryption failed — wrong master password or corrupted data")]
    Decryption,
    #[error("invalid encoding")]
    Encoding,
}

/// Derives a 256-bit key from a master password + salt using Argon2id.
/// Parameters chosen to be reasonably strong for an interactive desktop app
/// (~19 MiB memory, 2 iterations, 1 lane) — tune upward if hardware allows.
pub fn derive_key(master_password: &str, salt_b64: &str) -> Result<Zeroizing<[u8; KEY_LEN]>, CryptoError> {
    let salt_bytes = B64.decode(salt_b64).map_err(|_| CryptoError::Encoding)?;
    let params = Params::new(19_456, 2, 1, Some(KEY_LEN)).map_err(|_| CryptoError::Derivation)?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut out = Zeroizing::new([0u8; KEY_LEN]);
    argon2
        .hash_password_into(master_password.as_bytes(), &salt_bytes, out.as_mut())
        .map_err(|_| CryptoError::Derivation)?;
    Ok(out)
}

/// Generates a new random salt, base64-encoded for storage in vault_config.
pub fn generate_salt() -> String {
    let salt = SaltString::generate(&mut rand::rngs::OsRng);
    salt.to_string()
}

/// Argon2's own SaltString isn't guaranteed fixed-length bytes when decoded
/// generically, so we instead generate a raw random salt ourselves and
/// base64-encode it — simpler and fixed-size, still cryptographically random.
pub fn generate_raw_salt() -> String {
    let mut bytes = [0u8; 16];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    B64.encode(bytes)
}

/// Encrypts plaintext with AES-256-GCM under the given key.
/// Returns (ciphertext_b64, nonce_b64).
pub fn encrypt(key: &[u8; KEY_LEN], plaintext: &str) -> Result<(String, String), CryptoError> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| CryptoError::Encryption)?;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    AesOsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|_| CryptoError::Encryption)?;

    Ok((B64.encode(ciphertext), B64.encode(nonce_bytes)))
}

/// Decrypts a ciphertext produced by `encrypt` using the given key + nonce.
pub fn decrypt(key: &[u8; KEY_LEN], ciphertext_b64: &str, nonce_b64: &str) -> Result<String, CryptoError> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| CryptoError::Decryption)?;
    let ciphertext = B64.decode(ciphertext_b64).map_err(|_| CryptoError::Encoding)?;
    let nonce_bytes = B64.decode(nonce_b64).map_err(|_| CryptoError::Encoding)?;
    if nonce_bytes.len() != NONCE_LEN {
        return Err(CryptoError::Decryption);
    }
    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| CryptoError::Decryption)?;

    String::from_utf8(plaintext).map_err(|_| CryptoError::Decryption)
}

/// Builds a verifier value used to check a master password without ever
/// storing it: we encrypt a known constant string with the derived key, and
/// on unlock we try to decrypt it. Success == correct password. This avoids
/// needing a second KDF/hash scheme just for verification.
pub const VERIFIER_PLAINTEXT: &str = "nexforge-vault-v1";

pub fn make_verifier(key: &[u8; KEY_LEN]) -> Result<(String, String), CryptoError> {
    encrypt(key, VERIFIER_PLAINTEXT)
}

pub fn check_verifier(key: &[u8; KEY_LEN], ciphertext_b64: &str, nonce_b64: &str) -> bool {
    match decrypt(key, ciphertext_b64, nonce_b64) {
        Ok(plaintext) => plaintext == VERIFIER_PLAINTEXT,
        Err(_) => false,
    }
}
