// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC165_Initia} from "./IERC165.sol";

interface IERC20_Initia is IERC165_Initia {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function sudoTransfer(address sender, address recipient, uint256 amount) external;
}
