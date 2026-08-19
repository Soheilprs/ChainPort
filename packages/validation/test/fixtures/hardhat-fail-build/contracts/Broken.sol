pragma solidity ^0.8.24;

contract Broken {
    function nope() public {
        notAThing();
    }
}
