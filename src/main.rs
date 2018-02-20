#[macro_use]
extern crate serde_derive;
extern crate serde;
extern crate serde_json;
extern crate lcs_diff;
extern crate base64;

use std::os::raw::{c_char, c_void};
use std::mem;
use std::ffi::CString;
use base64::encode;

#[no_mangle]
pub fn alloc(size: usize) -> *mut c_void {
    let mut buf = Vec::with_capacity(size);
    let ptr = buf.as_mut_ptr();
    mem::forget(buf);
    return ptr as *mut c_void;
}

#[no_mangle]
pub fn free(ptr: *mut c_void, size: usize) {
    unsafe {
        let _buf = Vec::from_raw_parts(ptr, 0, size);
    }
}

fn compute_range(r: &Vec<usize>) -> Vec<(usize, usize)> {
    let mut i = 0;
    let mut j = 0;
    let mut acc: usize;
    let mut y1: usize;
    let mut ranges: Vec<(usize, usize)> = Vec::new();
    while i < r.len() {
        y1 = r[i];
        acc = y1;
        i += 1;
        loop {
            if i >= r.len() {
                break;
            }
            let index = r[i];
            if acc + 1 != index {
                break;
            }
            acc = index;
            i += 1;
            j += 1;
        }
        let y2 = y1 + j;
        j = 0;
        ranges.push((y1, y2));
    }
    ranges
}

fn create_encoded_rows(buf: &[u8], width: usize) -> Vec<String> {
    buf.chunks(width * 4)
        .map(|chunk| encode(chunk))
        .collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Result {
    before: Vec<(usize, usize)>,
    after: Vec<(usize, usize)>,
}

fn main() {}

#[no_mangle]
pub fn diff(before_ptr: *mut u8,
            before_len: usize,
            before_width: usize,
            after_ptr: *mut u8,
            after_len: usize,
            after_width: usize)
            -> *mut c_char {
    let before_buf: &[u8] = unsafe { std::slice::from_raw_parts_mut(before_ptr, before_len) };
    let after_buf: &[u8] = unsafe { std::slice::from_raw_parts_mut(after_ptr, after_len) };
    let imga = create_encoded_rows(before_buf, before_width);
    let imgb = create_encoded_rows(after_buf, after_width);
    let result = lcs_diff::diff(&imga, &imgb);
    let mut added: Vec<usize> = Vec::new();
    let mut removed: Vec<usize> = Vec::new();
    for d in result.iter() {
        match d {
            &lcs_diff::DiffResult::Added(ref a) => added.push(a.new_index.unwrap()),
            &lcs_diff::DiffResult::Removed(ref r) => removed.push(r.old_index.unwrap()),
            _ => (),
        }
    }

    let result = Result {
        after: compute_range(&added),
        before: compute_range(&removed),
    };

    let res = serde_json::to_string(&result).unwrap();
    let c_str = CString::new(res).unwrap();
    c_str.into_raw()
}

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}
