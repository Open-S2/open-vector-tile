#![no_std]

pub mod value;

/// this is documentation
pub fn add(left: usize, right: usize) -> usize {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // this is a comment
    fn it_works() {
        let result = add(1, 2);
        let result2 = add(1, 1);

        assert_eq!(result, 3);
        assert_eq!(result2, 2);
    }
}
