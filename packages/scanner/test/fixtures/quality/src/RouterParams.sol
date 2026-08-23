pragma solidity ^0.8.24;

contract RouterParams {
    function setUp() public {
        params = RouterParameters({
            v3Factory: 0x3333333333333333333333333333333333333333,
            weth9: 0x5555555555555555555555555555555555555555,
            v4PoolManager: 0x6666666666666666666666666666666666666666
        });
    }
}
