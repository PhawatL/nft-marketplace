import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ethers } from 'ethers'
import Home from '../pages/index'

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    Contract: jest.fn(),
    providers: {
      Web3Provider: jest.fn(),
      JsonRpcProvider: jest.fn()
    },
    utils: {
      parseEther: jest.fn().mockReturnValue('100000000000000000'),
      formatEther: jest.fn().mockReturnValue('0.1')
    }
  }
}))

// Mock web3modal
jest.mock('web3modal', () => {
  return jest.fn().mockImplementation(() => {
    return {
      connect: jest.fn().mockResolvedValue({})
    }
  })
})

describe('Home', () => {
  const mockAddress = '0x123'
  let mockProvider: any
  let mockSigner: any
  let mockContract: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockSigner = {
      getAddress: jest.fn().mockResolvedValue(mockAddress),
    }

    mockProvider = {
      getSigner: jest.fn().mockReturnValue(mockSigner)
    }

    mockContract = {
      mintNft: jest.fn().mockResolvedValue({ wait: jest.fn() }),
      approve: jest.fn().mockResolvedValue({ wait: jest.fn() }),
      listItem: jest.fn().mockResolvedValue({ wait: jest.fn() }),
      buyItem: jest.fn().mockResolvedValue({ wait: jest.fn() }),
      getTokenCounter: jest.fn().mockResolvedValue(0),
      getListing: jest.fn().mockResolvedValue({ price: '0', seller: '0x0' })
    }

    ethers.providers.Web3Provider.mockImplementation(() => mockProvider)
    ethers.providers.JsonRpcProvider.mockImplementation(() => mockProvider)
    ethers.Contract.mockImplementation(() => mockContract)
  })

  describe('Initial Render', () => {
    it('renders connect wallet button', () => {
      render(<Home />)
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument()
    })

    it('renders mint NFT button', () => {
      render(<Home />)
      expect(screen.getByText('Mint New NFT')).toBeInTheDocument()
    })

    it('renders Listed NFTs section', () => {
      render(<Home />)
      expect(screen.getByText('Listed NFTs')).toBeInTheDocument()
    })
  })

  describe('Wallet Connection', () => {
    it('connects wallet when button clicked', async () => {
      render(<Home />)
      const connectButton = screen.getByText('Connect Wallet')
      
      await act(async () => {
        fireEvent.click(connectButton)
      })

      await waitFor(() => {
        expect(screen.getByText(/Connected:/)).toBeInTheDocument()
      })
    })

    it('displays shortened wallet address after connection', async () => {
      render(<Home />)
      const connectButton = screen.getByText('Connect Wallet')
      
      await act(async () => {
        fireEvent.click(connectButton)
      })

      await waitFor(() => {
        expect(screen.getByText(`Connected: ${mockAddress.slice(0,6)}...${mockAddress.slice(-4)}`)).toBeInTheDocument()
      })
    })
  })

  describe('NFT Minting', () => {
    it('mints NFT when mint button clicked', async () => {
      render(<Home />)
      const mintButton = screen.getByText('Mint New NFT')
      
      await act(async () => {
        fireEvent.click(mintButton)
      })

      await waitFor(() => {
        expect(mockContract.mintNft).toHaveBeenCalled()
      })
    })

    it('shows success alert after minting', async () => {
      const alertMock = jest.spyOn(window, 'alert').mockImplementation()
      render(<Home />)
      const mintButton = screen.getByText('Mint New NFT')
      
      await act(async () => {
        fireEvent.click(mintButton)
      })

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('NFT Minted Successfully!')
      })
    })

    it('handles minting error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      mockContract.mintNft.mockRejectedValue(new Error('Minting failed'))
      
      render(<Home />)
      const mintButton = screen.getByText('Mint New NFT')
      
      await act(async () => {
        fireEvent.click(mintButton)
      })

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error minting NFT:', expect.any(Error))
      })
    })
  })

  describe('NFT Listing Display', () => {
    const mockNfts = [{
      tokenId: 0,
      seller: mockAddress,
      price: ethers.utils.parseEther('0.1').toString()
    }]

    beforeEach(() => {
      mockContract.getTokenCounter.mockResolvedValue(1)
      mockContract.getListing.mockResolvedValue({
        price: mockNfts[0].price,
        seller: mockNfts[0].seller
      })
    })

    it('displays NFTs when loaded', async () => {
      render(<Home />)
      
      await waitFor(() => {
        expect(screen.getByText(/Token ID: 0/)).toBeInTheDocument()
        expect(screen.getByText(/Price: 0.1 ETH/)).toBeInTheDocument()
      })
    })

    it('shows loading state while fetching NFTs', async () => {
      render(<Home />)
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('displays empty state when no NFTs are listed', async () => {
      mockContract.getTokenCounter.mockResolvedValue(0)
      render(<Home />)
      
      await waitFor(() => {
        expect(screen.queryByText(/Token ID:/)).not.toBeInTheDocument()
      })
    })
  })

  describe('NFT Buying', () => {
    const mockNfts = [{
      tokenId: 0,
      seller: mockAddress,
      price: ethers.utils.parseEther('0.1').toString()
    }]

    beforeEach(() => {
      mockContract.getTokenCounter.mockResolvedValue(1)
      mockContract.getListing.mockResolvedValue({
        price: mockNfts[0].price,
        seller: mockNfts[0].seller
      })
    })

    it('handles buy NFT action', async () => {
      render(<Home />)
      
      await waitFor(() => {
        const buyButton = screen.getByText('Buy NFT')
        fireEvent.click(buyButton)
      })
      
      await waitFor(() => {
        expect(mockContract.buyItem).toHaveBeenCalled()
      })
    })

    it('shows success alert after buying', async () => {
      const alertMock = jest.spyOn(window, 'alert').mockImplementation()
      render(<Home />)
      
      await waitFor(() => {
        const buyButton = screen.getByText('Buy NFT')
        fireEvent.click(buyButton)
      })
      
      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('NFT Purchased Successfully!')
      })
    })

    it('handles buying error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      mockContract.buyItem.mockRejectedValue(new Error('Purchase failed'))
      
      render(<Home />)
      
      await waitFor(() => {
        const buyButton = screen.getByText('Buy NFT')
        fireEvent.click(buyButton)
      })
      
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error buying NFT:', expect.any(Error))
      })
    })
  })
}) 