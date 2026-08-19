const assert = require("node:assert");

describe("hardhat workspace", function () {
  it("loads the compiler version from config", function () {
    const hre = require("hardhat");
    assert.equal(hre.config.solidity.compilers[0].version, "0.8.24");
  });
});
