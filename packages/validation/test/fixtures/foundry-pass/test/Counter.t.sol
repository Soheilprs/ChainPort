// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Counter} from "../src/Counter.sol";

contract CounterTest {
    Counter internal counter;

    function setUp() public {
        counter = new Counter();
    }

    function testInc() public {
        counter.inc();
        require(counter.n() == 1, "inc");
    }
}
