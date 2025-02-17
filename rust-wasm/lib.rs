#![no_std]
#![cfg(target_arch = "wasm32")]

extern crate alloc;
extern crate ovtile;

use alloc::{boxed::Box, slice, vec::Vec};
use core::mem;
use ovtile::VectorTile;

use lol_alloc::{AssumeSingleThreaded, FreeListAllocator};

// SAFETY: This application is single threaded, so using AssumeSingleThreaded is allowed.
#[global_allocator]
static ALLOCATOR: AssumeSingleThreaded<FreeListAllocator> =
    unsafe { AssumeSingleThreaded::new(FreeListAllocator::new()) };

mod wasm_specific {
    #[panic_handler]
    fn panic(_info: &core::panic::PanicInfo) -> ! {
        loop {}
    }
}

// Expose the function to JavaScript via #[export_name]
#[no_mangle]
pub extern "C" fn create_vector_tile(data_ptr: *const u8, data_len: usize) -> *mut VectorTile {
    // Convert the pointer and length into a slice
    let data_slice = unsafe { slice::from_raw_parts(data_ptr, data_len) };

    // Convert slice into Vec<u8> (we need to box this data for ownership)
    let data_vec = data_slice.to_vec();

    // Create the VectorTile instance
    let vector_tile = VectorTile::new(data_vec, None);

    // Box it and return as raw pointer
    Box::into_raw(Box::new(vector_tile))
}

#[no_mangle]
pub extern "C" fn free_vector_tile(ptr: *mut VectorTile) {
    if !ptr.is_null() {
        unsafe {
            _ = Box::from_raw(ptr); // Deallocate memory
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn allocUnicodeArray(size: usize) -> *mut u8 {
    // Allocate memory
    let mut buffer: Vec<u8> = Vec::with_capacity(size);
    buffer.capacity();
    // Ensure capacity matches size to avoid resizing
    buffer.set_len(size);
    // Get a raw pointer to the allocated memory
    let ptr = buffer.as_mut_ptr();
    // Prevent the buffer from being deallocated when it goes out of scope
    mem::forget(buffer);

    ptr
}

#[no_mangle]
pub unsafe extern "C" fn free(ptr: *mut u8, size: usize) {
    // Convert the pointer to a slice and then drop it
    let _ = core::slice::from_raw_parts_mut(ptr, size);

    // Deallocate the memory
    alloc::alloc::dealloc(ptr as *mut u8, alloc::alloc::Layout::array::<u8>(size).unwrap());
}
