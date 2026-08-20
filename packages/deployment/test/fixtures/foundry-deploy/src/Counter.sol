// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Counter {
    uint256 public n;

    function inc() public {
        n += 1;
    }
}
