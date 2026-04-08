// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

address constant COSMOS_ADDRESS = 0x00000000000000000000000000000000000000f1;
ICosmos constant COSMOS_CONTRACT = ICosmos(COSMOS_ADDRESS);

interface ICosmos {
    function is_blocked_address(address account) external view returns (bool blocked);
    function is_module_address(address account) external view returns (bool module);
    function is_authority_address(address account) external view returns (bool authority);
    function to_cosmos_address(address evm_address) external view returns (string memory cosmos_address);
    function to_evm_address(string memory cosmos_address) external view returns (address evm_address);
    function to_denom(address erc20_address) external view returns (string memory denom);
    function to_erc20(string memory denom) external view returns (address erc20_address);
    function disable_execute_cosmos() external returns (bool dummy);
    function execute_cosmos(string memory msg, uint64 gas_limit) external returns (bool dummy);
}
