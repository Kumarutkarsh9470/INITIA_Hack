// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./ICosmos.sol";

address constant CHAIN_ADDRESS = 0x0000000000000000000000000000000000000001;

contract ERC20ACL {
    modifier onlyChain() {
        require(msg.sender == CHAIN_ADDRESS, "ERC20: caller is not the chain");
        _;
    }

    modifier onlyAuthority() {
        require(
            COSMOS_CONTRACT.is_authority_address(msg.sender),
            "ERC20: caller is not the authority"
        );
        _;
    }

    modifier burnable(address from) {
        require(
            !COSMOS_CONTRACT.is_module_address(from),
            "ERC20: burn from module address"
        );
        _;
    }

    modifier mintable(address to) {
        require(
            !COSMOS_CONTRACT.is_blocked_address(to),
            "ERC20: mint to blocked address"
        );
        _;
    }

    modifier transferable(address to) {
        require(
            !COSMOS_CONTRACT.is_blocked_address(to),
            "ERC20: transfer to blocked address"
        );
        _;
    }
}
