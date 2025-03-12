import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import Web3Modal from 'web3modal'
import {
  NFT_MARKETPLACE_ADDRESS,
  NFT_MARKETPLACE_ABI,
  BASIC_NFT_ADDRESS,
  BASIC_NFT_ABI
} from '../constants'

export default function Home() {
  const [nfts, setNfts] = useState([])
  const [loading, setLoading] = useState(false)
  const [account, setAccount] = useState('')

  async function connectWallet() {
    const web3Modal = new Web3Modal()
    const connection = await web3Modal.connect()
    const provider = new ethers.providers.Web3Provider(connection)
    const signer = provider.getSigner()
    const address = await signer.getAddress()
    setAccount(address)
    return signer
  }

  async function mintNFT() {
    try {
      const signer = await connectWallet()
      const nftContract = new ethers.Contract(BASIC_NFT_ADDRESS, BASIC_NFT_ABI, signer)
      const tx = await nftContract.mintNft()
      await tx.wait()
      alert('NFT Minted Successfully!')
    } catch (error) {
      console.error('Error minting NFT:', error)
    }
  }

  async function listNFT(tokenId: number) {
    try {
      const signer = await connectWallet()
      const price = ethers.utils.parseEther('0.1') // 0.1 ETH
      const nftContract = new ethers.Contract(BASIC_NFT_ADDRESS, BASIC_NFT_ABI, signer)
      const marketplaceContract = new ethers.Contract(NFT_MARKETPLACE_ADDRESS, NFT_MARKETPLACE_ABI, signer)
      
      // Approve marketplace
      await nftContract.approve(NFT_MARKETPLACE_ADDRESS, tokenId)
      // List NFT
      const tx = await marketplaceContract.listItem(BASIC_NFT_ADDRESS, tokenId, price)
      await tx.wait()
      alert('NFT Listed Successfully!')
    } catch (error) {
      console.error('Error listing NFT:', error)
    }
  }

  async function buyNFT(tokenId: number, price: string) {
    try {
      const signer = await connectWallet()
      const marketplaceContract = new ethers.Contract(NFT_MARKETPLACE_ADDRESS, NFT_MARKETPLACE_ABI, signer)
      const tx = await marketplaceContract.buyItem(BASIC_NFT_ADDRESS, tokenId, {
        value: price
      })
      await tx.wait()
      alert('NFT Purchased Successfully!')
    } catch (error) {
      console.error('Error buying NFT:', error)
    }
  }

  async function loadNFTs() {
    setLoading(true)
    try {
      const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545/')
      const marketplaceContract = new ethers.Contract(NFT_MARKETPLACE_ADDRESS, NFT_MARKETPLACE_ABI, provider)
      const nftContract = new ethers.Contract(BASIC_NFT_ADDRESS, BASIC_NFT_ABI, provider)
      
      const tokenCounter = await nftContract.getTokenCounter()
      const items = []
      
      for (let i = 0; i < tokenCounter; i++) {
        const listing = await marketplaceContract.getListing(BASIC_NFT_ADDRESS, i)
        if (listing.price.toString() !== '0') {
          items.push({
            tokenId: i,
            seller: listing.seller,
            price: listing.price.toString()
          })
        }
      }
      
      setNfts(items)
    } catch (error) {
      console.error('Error loading NFTs:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadNFTs()
  }, [])

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="bg-gray-800 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-white text-xl font-bold">NFT Marketplace</h1>
          <button
            onClick={connectWallet}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            {account ? `Connected: ${account.slice(0,6)}...${account.slice(-4)}` : 'Connect Wallet'}
          </button>
        </div>
      </nav>

      <main className="container mx-auto p-4">
        <div className="mb-8">
          <button
            onClick={mintNFT}
            className="bg-green-500 text-white px-6 py-2 rounded"
          >
            Mint New NFT
          </button>
        </div>

        <h2 className="text-2xl font-bold mb-4">Listed NFTs</h2>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nfts.map((nft: any) => (
              <div key={nft.tokenId} className="border p-4 rounded">
                <p>Token ID: {nft.tokenId}</p>
                <p>Seller: {nft.seller.slice(0,6)}...{nft.seller.slice(-4)}</p>
                <p>Price: {ethers.utils.formatEther(nft.price)} ETH</p>
                <button
                  onClick={() => buyNFT(nft.tokenId, nft.price)}
                  className="bg-blue-500 text-white px-4 py-2 rounded mt-2"
                >
                  Buy NFT
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
} 