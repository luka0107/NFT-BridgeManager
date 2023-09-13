// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
// import "./console.sol";

contract NFTCollection is Ownable {
    using Counters for Counters.Counter;

    string public name;
    string public symbol;
    string public baseURI;
    uint256 public collection_ID;
    string public original_chain;
    address public original_collection_address;
    mapping(string => string) public chain_contract_addresses;

    Counters.Counter private _token_Id_counter;

    event Add_Chain(address collection, string chain, string contractAddress);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        string memory original_chain_,
        address original_collection_address_
    ) {
        name = name_;
        symbol = symbol_;
        baseURI = baseURI_;
        original_chain = original_chain_;
        original_collection_address = original_collection_address_;
        collection_ID = _token_Id_counter.current();
        _token_Id_counter.increment();
    }

    /**
     * Add Contract address in chain to collection
     */
    function add_chain_contract(
        string memory chain,
        string memory contract_address
    ) external onlyOwner {
        chain_contract_addresses[chain] = contract_address;
        emit Add_Chain(address(this), chain, contract_address);
    }

    /**
     * Get Contract address of chain in collection
     */
    function get_chain_contract(
        string memory chain
    ) external view returns (string memory) {
        require(
            bytes(chain_contract_addresses[chain]).length != 0,
            "No contract associated with the chain"
        );
        return chain_contract_addresses[chain];
    }
}
