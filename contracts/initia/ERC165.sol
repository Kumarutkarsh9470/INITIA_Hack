// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC165_Initia} from "./IERC165.sol";

abstract contract ERC165_Initia is IERC165_Initia {
    function supportsInterface(bytes4 interfaceId)
        public view virtual returns (bool)
    {
        return interfaceId == type(IERC165_Initia).interfaceId;
    }
}
