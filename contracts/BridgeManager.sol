// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./NFTCollection.sol";
import "./IERC721PlusInterface.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "hardhat/console.sol";

contract BridgeManager is Pausable, Ownable, IERC721Receiver {
    using ECDSA for BridgeManager;
    NFTCollection[] collections;
    mapping(address => bool) public is_minted;
    mapping(address => mapping(uint => uint)) public nonces;

    uint public fee = 5e18; // 5$
    address public payment_account = msg.sender;

    AggregatorV3Interface public ethUsdPriceFeed =
        AggregatorV3Interface(0x694AA1769357215DE4FAC081bf1f309aDC325306); //sepolia

    event MintCollection(
        address addr,
        string name,
        string symbol,
        string baseURI,
        string originalChain,
        address originalCollectionAddress
    );
    event SetFee(uint fee);
    event PaymentAccountSet(address paymentAccount);
    event PushedToBridge(
        address collection,
        uint tokenId,
        string destChain,
        string destAddress,
        uint nonce
    );
    event PulledFromBridge(
        address collection,
        uint tokenId,
        string srcChain,
        string srcAddress,
        uint nonce
    );

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * Create NFT Collection to Bridge
     */
    function mintCollection(
        string memory name,
        string memory symbol,
        string memory baseURI,
        string memory originalChain,
        address originalCollectionAddress
    ) external onlyOwner whenNotPaused {
        NFTCollection collection = new NFTCollection(
            name,
            symbol,
            baseURI,
            originalChain,
            originalCollectionAddress
        );
        collections.push(collection);
        is_minted[address(collection)] = true;
        emit MintCollection(
            address(collection),
            name,
            symbol,
            baseURI,
            originalChain,
            originalCollectionAddress
        );
    }

    /**
     * Add Contract addresses from different chains to collection
     */
    function addChainsToCollection(
        NFTCollection collection,
        string[] memory chains,
        string[] memory contractAddresses
    ) external onlyOwner whenNotPaused {
        require(is_minted[address(collection)], "Invalid collection address");
        require(
            chains.length == contractAddresses.length,
            "Arrays length mismatch"
        );
        for (uint i = 0; i < chains.length; i++) {
            collection.add_chain_contract(chains[i], contractAddresses[i]);
        }
    }

    /**
     * Get Contract address of chain in collection
     */
    function getChainContract(
        NFTCollection collection,
        string memory chain
    ) external view returns (string memory) {
        require(is_minted[address(collection)], "Invalid collection address");
        return collection.get_chain_contract(chain);
    }

    /**
     * Send token from sender to bridge
     */
    // function pushTokenToBridge(
    function sendTokenToBridge(
        NFTCollection collection,
        uint256 tokenId,
        string memory destChain,
        string memory destCollectionAddress,
        bool takeFee
    ) external payable whenNotPaused {
        require(is_minted[address(collection)], "Invalid collection address");
        transferFees(takeFee);
        IERC721PlusInterface collectionContract = IERC721PlusInterface(
            collection.original_collection_address()
        );
        collectionContract.transferFrom(msg.sender, address(this), tokenId);
        emit PushedToBridge(
            address(collection),
            tokenId,
            destChain,
            destCollectionAddress,
            nonces[address(collection)][tokenId]++
        );
    }

    /**
     * Send token from bridge to sender
     */
    function pullTokenFromBridge(
        NFTCollection collection,
        uint256 tokenId,
        string memory srcChain,
        string memory srcAddress,
        bytes memory signature,
        bool takeFee
    ) external payable whenNotPaused {
        require(is_minted[address(collection)], "Invalid collection address");

        checkSignature(collection, tokenId, takeFee, signature);

        transferFees(takeFee);

        IERC721PlusInterface collectionContract = IERC721PlusInterface(
            collection.original_collection_address()
        );
        // Mint token only possible in chains owned by the bridge.
        if (/* !collection.is_original_chain_ETH() &&  */!collectionContract.exists(tokenId)) {
            console.log("tokenId doesn't exist");
            collectionContract.safeMintToken(msg.sender, tokenId);
        }
        // For chains not owned by the bridge, Transfer will revert if token does not exist
        else {
            console.log("tokenId exists");
            collectionContract.transferFrom(address(this), msg.sender, tokenId);
        }

        emit PulledFromBridge(
            address(collection),
            tokenId,
            srcChain,
            srcAddress,
            nonces[address(collection)][tokenId]++
        );
    }

    /**
     * Verify bridge owner's signature
     */
    function checkSignature(
        NFTCollection collection,
        uint256 tokenId,
        bool takeFee,
        bytes memory signature
    ) internal view {
        bytes memory message = abi.encode(
            msg.sender,
            address(this),
            address(collection),
            tokenId,
            takeFee,
            nonces[address(collection)][tokenId]
        );
        bytes32 msgHash = ECDSA.toEthSignedMessageHash(keccak256(message));
        console.log("msgHash:");
        console.logBytes32(msgHash);
        (address signer, ) = ECDSA.tryRecover(msgHash, signature);
        console.log("signer:", signer);
        console.log("owner():", owner());
        require(signer == owner(), "Not signed by owner");
    }

    /**
     * Transfer bridge fees to payment_account
     */
    function transferFees(bool takeFee) internal {
        uint eth_fee = 0;
        if (takeFee) {
            eth_fee = (fee * 1e8) / 1850 /* getLatestPrice() */;
        }
        require(msg.value >= eth_fee, "Must pay fee");
        if (msg.value > eth_fee)
            payable(msg.sender).transfer(msg.value - eth_fee);
        if (eth_fee > 0) payable(payment_account).transfer(eth_fee);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /**
     * Get list of collections in bridge
     */
    function getCollections() external view returns (NFTCollection[] memory) {
        return collections;
    }

    function setFee(uint fee_) external onlyOwner {
        fee = fee_;
        emit SetFee(fee_);
    }

    function setPaymentAccount(address payment_account_) external onlyOwner {
        payment_account = payment_account_;
        emit PaymentAccountSet(payment_account_);
    }

    /**
     * Get Latest exchange rate from price feed
     */
    function getLatestPrice() public view returns (uint256) {
        (
            ,
            /*uint80 roundID*/ int price /*uint startedAt*/ /*uint timeStamp*/ /*uint80 answeredInRound*/,
            ,
            ,

        ) = ethUsdPriceFeed.latestRoundData();

        return uint256(price); //  example price returned 3034715771688
    }

    function setPriceFeed(address newFeed) public onlyOwner whenNotPaused {
        ethUsdPriceFeed = AggregatorV3Interface(newFeed);
    }

    /**
     * Fallback method in case of abandoning bridge
     */
    function transferCollectionOwnership(
        address collectionAddress,
        address newOwner
    ) external onlyOwner whenNotPaused {
        Ownable(collectionAddress).transferOwnership(newOwner);
    }
}
