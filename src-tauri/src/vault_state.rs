//! In-memory vault runtime state: the derived encryption key (only while
//! unlocked) and the auto-lock timer. The key is wrapped in `Zeroizing` so
//! it is wiped from memory the moment it's dropped (on lock, on app exit,
//! or when overwritten by a new unlock).

use std::sync::Mutex;
use std::time::Instant;
use zeroize::Zeroizing;

use crate::crypto::KEY_LEN;

pub struct VaultRuntime {
    pub key: Option<Zeroizing<[u8; KEY_LEN]>>,
    pub last_activity: Instant,
    pub auto_lock_minutes: i64,
}

impl Default for VaultRuntime {
    fn default() -> Self {
        Self {
            key: None,
            last_activity: Instant::now(),
            auto_lock_minutes: 15,
        }
    }
}

pub struct VaultState(pub Mutex<VaultRuntime>);

impl VaultState {
    pub fn new() -> Self {
        VaultState(Mutex::new(VaultRuntime::default()))
    }
}

/// Checks whether the vault should be considered locked due to inactivity,
/// and if so, clears the key. Called at the top of every sensitive command.
pub fn enforce_autolock(state: &VaultState) {
    let mut rt = state.0.lock().unwrap();
    if rt.key.is_none() {
        return;
    }
    if rt.auto_lock_minutes <= 0 {
        return; // "Never"
    }
    let elapsed = rt.last_activity.elapsed().as_secs();
    let limit = (rt.auto_lock_minutes as u64) * 60;
    if elapsed >= limit {
        rt.key = None; // Zeroizing drop wipes the bytes
    }
}

pub fn touch(state: &VaultState) {
    let mut rt = state.0.lock().unwrap();
    rt.last_activity = Instant::now();
}
