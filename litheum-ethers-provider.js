/**
 * Litheum Ethers Provider
 * 
 * This provider works with Ethers.js v6 to connect to the Litheum network.
 * It requires the injected window.litheum (Litheum Wallet).
 * Sends are reconciled to use native proto transactions (favoring protos over RLP).
 * Normal ethers interface (signer.sendTransaction, contract calls) is supported.
 */

(function() {
    'use strict';

    // Check if ethers is loaded
    if (typeof ethers === 'undefined') {
        console.error('Litheum Ethers Provider: ethers.js must be loaded before this provider');
        return;
    }

    /**
     * Creates a Litheum provider for Ethers.js v6
     * Uses normal ethers interface. Reconciles sends to favor proto txs via wallet.
     * Throws if window.litheum not present.
     * @returns {ethers.BrowserProvider} An Ethers.js provider connected to Litheum
     */
    function getLitheumProvider() {
        if (typeof window !== 'undefined' && window.litheum) {
            console.log('Litheum Ethers Provider: Using injected litheum provider (proto)');
            const reconcilingProvider = {
                request: async (args) => {
                    if (!args || typeof args.method !== 'string') {
                        throw new Error('Invalid RPC request');
                    }
                    const { method, params = [] } = args;
                    if (method === 'eth_sendTransaction') {
                        const tx = params[0] || {};
                        const value = (tx.value != null)
                            ? (typeof tx.value === 'bigint' ? tx.value.toString() : (tx.value.toString ? tx.value.toString() : String(tx.value)))
                            : '0';
                        return await window.litheum.request({
                            method: 'litheum_sendContractTransaction',
                            params: [{
                                to: tx.to,
                                data: tx.data || '0x',
                                value: value
                            }]
                        });
                    }
                    if (method === 'eth_sendRawTransaction') {
                        throw new Error('eth_sendRawTransaction not supported; Litheum provider favors native proto transactions');
                    }
                    // forward reads, accounts, calls etc.
                    return await window.litheum.request({ method, params });
                }
            };
            return new ethers.BrowserProvider(reconcilingProvider);
        }
        throw new Error('Litheum wallet (window.litheum) is not present. This provider requires the Litheum Wallet and throws on absence (no RPC/ethereum fallback).');
    }

    /**
     * Creates a Litheum provider with automatic network switching
     * @returns {ethers.BrowserProvider} An Ethers.js provider that ensures Litheum network
     */
    async function getLitheumProviderWithSwitch() {
        const provider = getLitheumProvider();
        
        // If using injected provider, try to switch to Litheum network
        if (provider._provider && provider._provider.request) {
            try {
                const chainId = '0x' + (8584).toString(16); // Litheum chainId (update to actual)
                const chainData = {
                    chainId: chainId,
                    chainName: 'Litheum Network',
                    nativeCurrency: {
                        name: 'Litheum',
                        symbol: 'LTH',
                        decimals: 18
                    },
                    rpcUrls: ['https://rpc.litheum.com'],
                    blockExplorerUrls: ['https://explorer.litheum.com']
                };

                try {
                    // Try to switch to Litheum network
                    await provider._provider.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: chainId }],
                    });
                } catch (switchError) {
                    // This error code indicates that the chain has not been added to MetaMask
                    if (switchError.code === 4902) {
                        await provider._provider.request({
                            method: 'wallet_addEthereumChain',
                            params: [chainData],
                        });
                    } else {
                        throw switchError;
                    }
                }
            } catch (error) {
                console.error('Failed to switch to Litheum network:', error);
            }
        }

        return provider;
    }

    /**
     * Helper function to create a signer from the provider
     * @param {ethers.BrowserProvider} provider - The Ethers provider
     * @param {number} [accountIndex=0] - The account index to use
     * @returns {Promise<ethers.Signer>} A signer for transactions
     */
    async function getSigner(provider, accountIndex = 0) {
        if (!provider) {
            provider = getLitheumProvider();
        }
        
        // For BrowserProvider, we need to request access first
        if (provider._provider && provider._provider.request) {
            try {
                await provider._provider.request({ method: 'eth_requestAccounts' });
            } catch (error) {
                console.error('Failed to request accounts:', error);
                throw error;
            }
        }

        return await provider.getSigner(accountIndex);
    }

    /**
     * Utility to get current block number
     * @returns {Promise<number>} Current block number
     */
    async function getBlockNumber() {
        const provider = getLitheumProvider();
        return await provider.getBlockNumber();
    }

    /**
     * Utility to get account balance
     * @param {string} address - The address to check
     * @returns {Promise<bigint>} Balance in wei
     */
    async function getBalance(address) {
        const provider = getLitheumProvider();
        return await provider.getBalance(address);
    }

    /**
     * Contract factory helper
     * @param {string} address - Contract address
     * @param {Array} abi - Contract ABI
     * @param {ethers.Signer} [signer] - Optional signer for write operations
     * @returns {ethers.Contract} Contract instance
     */
    function getContract(address, abi, signer) {
        const provider = signer || getLitheumProvider();
        return new ethers.Contract(address, abi, provider);
    }

    // Export to global scope
    if (typeof window !== 'undefined') {
        window.LitheumEthersProvider = {
            getProvider: getLitheumProvider,
            getProviderWithSwitch: getLitheumProviderWithSwitch,
            getSigner: getSigner,
            getBlockNumber: getBlockNumber,
            getBalance: getBalance,
            getContract: getContract,
            
            // Re-export ethers utilities for convenience
            utils: ethers,
            parseEther: ethers.parseEther,
            formatEther: ethers.formatEther,
            parseUnits: ethers.parseUnits,
            formatUnits: ethers.formatUnits,
            
            // Constants
            AddressZero: ethers.ZeroAddress,
            HashZero: ethers.ZeroHash,
        };

        console.log('Litheum Ethers Provider initialized. Access via window.LitheumEthersProvider');
    }

    // Also export for module systems
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            getProvider: getLitheumProvider,
            getProviderWithSwitch: getLitheumProviderWithSwitch,
            getSigner: getSigner,
            getBlockNumber: getBlockNumber,
            getBalance: getBalance,
            getContract: getContract,
        };
    }

})();