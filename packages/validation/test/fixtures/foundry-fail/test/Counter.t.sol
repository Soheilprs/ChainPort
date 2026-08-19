// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Counter} from "../src/Counter.sol";

contract CounterTest {
    function testAlwaysFails() public {
        Counter counter = new Counter();
        require(counter.n() == 1, "expected failure");
    }
}
