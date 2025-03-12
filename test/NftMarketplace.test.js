const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("NFT Marketplace", function () {
  let nftMarketplace, basicNft, deployer, buyer, seller
  const TOKEN_ID = 0
  const PRICE = ethers.utils.parseEther("0.1")

  beforeEach(async function () {
    // Get accounts
    [deployer, buyer, seller] = await ethers.getSigners()

    // Deploy BasicNft
    const BasicNft = await ethers.getContractFactory("BasicNft")
    basicNft = await BasicNft.deploy()
    await basicNft.deployed()

    // Deploy NftMarketplace
    const NftMarketplace = await ethers.getContractFactory("NftMarketplace")
    nftMarketplace = await NftMarketplace.deploy()
    await nftMarketplace.deployed()

    // Mint NFT
    await basicNft.mintNft()
  })

  describe("Deployment", function () {
    it("Should deploy with correct initial state", async function () {
      expect(await basicNft.getTokenCounter()).to.equal(1)
      const tokenURI = await basicNft.tokenURI(0)
      expect(tokenURI).to.be.a('string')
      expect(await basicNft.ownerOf(TOKEN_ID)).to.equal(deployer.address)
    })
  })

  describe("NFT Minting", function () {
    it("Should mint NFT successfully", async function () {
      await basicNft.mintNft()
      expect(await basicNft.getTokenCounter()).to.equal(2)
      expect(await basicNft.ownerOf(1)).to.equal(deployer.address)
    })

    it("Should emit Transfer event on mint", async function () {
      await expect(basicNft.mintNft())
        .to.emit(basicNft, 'Transfer')
        .withArgs(ethers.constants.AddressZero, deployer.address, 1)
    })
  })

  describe("Listing", function () {
    it("Should list NFT successfully", async function () {
      await basicNft.approve(nftMarketplace.address, TOKEN_ID)
      await expect(nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE))
        .to.emit(nftMarketplace, 'ItemListed')
        .withArgs(deployer.address, basicNft.address, TOKEN_ID, PRICE)
      
      const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
      expect(listing.price).to.equal(PRICE)
      expect(listing.seller).to.equal(deployer.address)
    })

    it("Should fail if NFT not approved", async function () {
      await expect(
        nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
      ).to.be.revertedWith("NftMarketplace__NotApprovedForMarketplace")
    })

    it("Should fail if price is zero", async function () {
      await basicNft.approve(nftMarketplace.address, TOKEN_ID)
      await expect(
        nftMarketplace.listItem(basicNft.address, TOKEN_ID, 0)
      ).to.be.revertedWith("NftMarketplace__PriceMustBeAboveZero")
    })

    it("Should fail if not owner", async function () {
      await basicNft.approve(nftMarketplace.address, TOKEN_ID)
      await expect(
        nftMarketplace.connect(buyer).listItem(basicNft.address, TOKEN_ID, PRICE)
      ).to.be.revertedWith("NftMarketplace__NotOwner")
    })

    it("Should fail if already listed", async function () {
      await basicNft.approve(nftMarketplace.address, TOKEN_ID)
      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
      await expect(
        nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
      ).to.be.revertedWith("NftMarketplace__AlreadyListed")
    })
  })

  describe("Buying", function () {
    beforeEach(async function () {
      await basicNft.approve(nftMarketplace.address, TOKEN_ID)
      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
    })

    it("Should buy NFT successfully", async function () {
      const initialSellerProceeds = await nftMarketplace.getProceeds(deployer.address)
      await nftMarketplace.connect(buyer).buyItem(basicNft.address, TOKEN_ID, {
        value: PRICE
      })

      const newOwner = await basicNft.ownerOf(TOKEN_ID)
      expect(newOwner).to.equal(buyer.address)
      
      const finalSellerProceeds = await nftMarketplace.getProceeds(deployer.address)
      expect(finalSellerProceeds).to.equal(initialSellerProceeds.add(PRICE))
    })

    it("Should emit ItemBought event", async function () {
      await expect(
        nftMarketplace.connect(buyer).buyItem(basicNft.address, TOKEN_ID, {
          value: PRICE
        })
      ).to.emit(nftMarketplace, 'ItemBought')
        .withArgs(buyer.address, basicNft.address, TOKEN_ID, PRICE)
    })

    it("Should fail if price not met", async function () {
      const lowPrice = ethers.utils.parseEther("0.05")
      await expect(
        nftMarketplace.connect(buyer).buyItem(basicNft.address, TOKEN_ID, {
          value: lowPrice
        })
      ).to.be.revertedWith("NftMarketplace__PriceNotMet")
    })

    it("Should fail if NFT not listed", async function () {
      await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
      await expect(
        nftMarketplace.connect(buyer).buyItem(basicNft.address, TOKEN_ID, {
          value: PRICE
        })
      ).to.be.revertedWith("NftMarketplace__NotListed")
    })

    it("Should fail if buyer is the seller", async function () {
      await expect(
        nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
          value: PRICE
        })
      ).to.be.revertedWith("NftMarketplace__NotOwner")
    })
  })

  describe("Canceling", function () {
    beforeEach(async function () {
      await basicNft.approve(nftMarketplace.address, TOKEN_ID)
      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
    })

    it("Should cancel listing successfully", async function () {
      await expect(nftMarketplace.cancelListing(basicNft.address, TOKEN_ID))
        .to.emit(nftMarketplace, 'ItemCanceled')
        .withArgs(deployer.address, basicNft.address, TOKEN_ID)

      const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
      expect(listing.price).to.equal(0)
    })

    it("Should fail if not owner", async function () {
      await expect(
        nftMarketplace.connect(buyer).cancelListing(basicNft.address, TOKEN_ID)
      ).to.be.revertedWith("NftMarketplace__NotOwner")
    })

    it("Should fail if not listed", async function () {
      await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
      await expect(
        nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
      ).to.be.revertedWith("NftMarketplace__NotListed")
    })
  })

  describe("Updating Price", function () {
    beforeEach(async function () {
      await basicNft.approve(nftMarketplace.address, TOKEN_ID)
      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
    })

    it("Should update price successfully", async function () {
      const newPrice = ethers.utils.parseEther("0.2")
      await expect(nftMarketplace.updateListing(basicNft.address, TOKEN_ID, newPrice))
        .to.emit(nftMarketplace, 'ItemListed')
        .withArgs(deployer.address, basicNft.address, TOKEN_ID, newPrice)

      const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
      expect(listing.price).to.equal(newPrice)
    })

    it("Should fail if price is zero", async function () {
      await expect(
        nftMarketplace.updateListing(basicNft.address, TOKEN_ID, 0)
      ).to.be.revertedWith("NftMarketplace__PriceMustBeAboveZero")
    })

    it("Should fail if not owner", async function () {
      await expect(
        nftMarketplace.connect(buyer).updateListing(basicNft.address, TOKEN_ID, PRICE)
      ).to.be.revertedWith("NftMarketplace__NotOwner")
    })

    it("Should fail if not listed", async function () {
      await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
      await expect(
        nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)
      ).to.be.revertedWith("NftMarketplace__NotListed")
    })
  })

  describe("Withdrawing Proceeds", function () {
    beforeEach(async function () {
      await basicNft.approve(nftMarketplace.address, TOKEN_ID)
      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
      await nftMarketplace.connect(buyer).buyItem(basicNft.address, TOKEN_ID, {
        value: PRICE
      })
    })

    it("Should withdraw proceeds successfully", async function () {
      const initialBalance = await ethers.provider.getBalance(deployer.address)
      const proceeds = await nftMarketplace.getProceeds(deployer.address)
      
      const tx = await nftMarketplace.withdrawProceeds()
      const receipt = await tx.wait()
      const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice)
      
      const finalBalance = await ethers.provider.getBalance(deployer.address)
      expect(finalBalance).to.equal(
        initialBalance.add(proceeds).sub(gasCost)
      )
    })

    it("Should fail if no proceeds", async function () {
      await expect(
        nftMarketplace.connect(seller).withdrawProceeds()
      ).to.be.revertedWith("NftMarketplace__NoProceeds")
    })

    it("Should set proceeds to zero after withdrawal", async function () {
      await nftMarketplace.withdrawProceeds()
      const proceeds = await nftMarketplace.getProceeds(deployer.address)
      expect(proceeds).to.equal(0)
    })

    it("Should handle multiple sales proceeds", async function () {
      // Mint and list another NFT
      await basicNft.mintNft()
      await basicNft.approve(nftMarketplace.address, 1)
      await nftMarketplace.listItem(basicNft.address, 1, PRICE)
      
      // Buy the second NFT
      await nftMarketplace.connect(buyer).buyItem(basicNft.address, 1, {
        value: PRICE
      })

      const proceeds = await nftMarketplace.getProceeds(deployer.address)
      expect(proceeds).to.equal(PRICE.mul(2))
    })
  })
}) 