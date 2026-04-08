// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./IERC20Registry.sol";

contract ERC20Registry {
    modifier register_erc20() {
        ERC20_REGISTRY_CONTRACT.register_erc20();
        _;
    }

    modifier register_erc20_store(address account) {
        if (!ERC20_REGISTRY_CONTRACT.is_erc20_store_registered(account)) {
            ERC20_REGISTRY_CONTRACT.register_erc20_store(account);
        }
        _;
    }
}
