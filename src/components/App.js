import React from 'react';
import {connect} from "react-redux";
import {bindActionCreators} from "redux";
import {actions as nimiqActions} from "../ducks/nimiq";
import Drawer from './Drawer';
import Loading from '../common/Loading';
import Setup from './Setup';
import Messages from './Messages';
import FullHeight from '../common/FullHeight';
import _ from 'lodash';
import Dexie from 'dexie';
import moment from 'moment';
import '../assets/css/App.css';


const $ = {};
var db;

class App extends React.Component {

    state = {
        clientType: "light",
        _pendingElapsed: 0,
        _pendingInterval: null,
        _receivingElapsed: 0,
        _receivingInterval: null,
        isReceiving: false,
        soundToPlay: "",
        isPlaying: false,
        walletCreated: false,
        walletLocked: false,
        mute: true
    };

    componentWillMount() {
        if (window.localStorage.i18nextLng) {
            this.props.nimiqActions.completeSetup(true)
        }
        this._startInstance();
        db = new Dexie('blocks');

        // Define a schema
        db.version(1).stores({
            blocks: 'blockHeight, minerAddr'
        });

        // Open the database
        db.open().catch(function (error) {
            alert('Uh oh : ' + error);
        });
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.nimiq.isMining !== this.props.nimiq.isMining) {
            if (nextProps.nimiq.isMining) {
                $.miner.startWork();
            }

            if (!nextProps.nimiq.isMining) {
                $.miner.stopWork();
            }
        }

        if (nextProps.nimiq.walletCreated && !this.state.walletCreated) {
            this.setState(
                {
                    walletCreated: true
                },
                () => {
                    this._startInstance();
                }
            );
        }

        if (nextProps.nimiq.walletLocked && !this.state.walletLocked) {
            this.setState(
                {
                    walletLocked: true
                },
                () => {
                    console.log("locking wallet");
                    // $.wallet.lock('secret').then(() => {
                    //     $.wallet.persist();
                    //     $.miner.stopWork();
                    // });
                }
            );
        }

        if (nextProps.nimiq.threadCount !== this.props.nimiq.threadCount) {
            $.miner.threads = nextProps.nimiq.threadCount
        }

        if (nextProps.nimiq.miningWallet !== this.props.nimiq.miningWallet) {
            this.startMiner(nextProps.nimiq.miningWallet)
        }

        if (nextProps.nimiq.isMining !== this.props.nimiq.isMining) {
            if (nextProps.nimiq.isMining) {
                $.miner.startWork();
            }

            if (!nextProps.nimiq.isMining) {
                $.miner.stopWork();
            }
        }
    }

    _onConsensusEstablished() {
        const {nimiqActions, nimiq} = this.props;
        nimiqActions.updateMessage("Consensus Established...");
        nimiqActions.updateConsensus(true);
        //nimiqActions.updateAddress($.wallet.address.toUserFriendlyAddress());
        this._updateBalance();

        $.blockchain.on("head-changed", this._updateBalance);
        this.props.nimiqActions.updateBlockHeight($.blockchain.height);
        nimiqActions.updateBlockReward(window.Nimiq.Policy.blockRewardAt($.blockchain.height));

        $.walletStore.hasDefault().then(hasDefault => {
            if (!hasDefault && nimiq.wallets.length > 0) {
                $.walletStore.setDefault(nimiq.wallets[0]._wlt.address).then(() => {
                    if (!localStorage.getItem('miningWallet')) {
                        this.startMiner(nimiq.wallets[0]._wlt.address)
                    } else {
                        var _address = Nimiq.Address.fromUserFriendlyAddress(JSON.parse(localStorage.getItem('miningWallet')))
                        this.startMiner(_address)
                    }
                })
            }

            if (hasDefault) {
                $.walletStore.getDefault().then((defaultWallet) => {
                    if (!localStorage.getItem('miningWallet')) {
                        this.startMiner(nimiq.wallets[0]._wlt.address)
                    } else {
                        var _address = Nimiq.Address.fromUserFriendlyAddress(JSON.parse(localStorage.getItem('miningWallet')))
                        this.startMiner(_address)
                    }
                })
            }
        });
    }

    _updateBalance = () => {
        if (this.state.clientType !== "nano") {
            // console.log("$.wallet.address ", $.wallet.address.toUserFriendlyAddress());
            //
            // $.accounts.get($.wallet.address).then(account => this._onBalanceChanged(account));
        } else {
            // $.consensus.getAccount($.wallet.address).then(account => this._onBalanceChanged(account));
        }
    };

    _onBalanceChanged(account) {
        account = account || window.Nimiq.BasicAccount.INITIAL;
        const balance = window.Nimiq.Policy.satoshisToCoins(account.balance).toFixed(2);
        this.props.nimiqActions.updateBalance(balance);
    }

    _onHeadChanged = () => {
        const height = $.blockchain.height;
        db.blocks.add({
            blockHeight: height,
            minerAddr: $.blockchain.head.body.minerAddr.toUserFriendlyAddress()
        });
        // const globalHashRate = this._getGlobalHashrate();
        // this.props.nimiqActions.updateHashRate({
        //     hashRate: this._setHashrate($.miner.hashrate),
        //     globalHashRate: globalHashRate
        // });
        this._updateAverageBlockTime();
        this.props.nimiqActions.updateBlockHeight(height);
    }

    _updateAverageBlockTime() {
        let self = this;
        const head = $.blockchain.head;
        const tailHeight = Math.max(head.height - Nimiq.Policy.DIFFICULTY_BLOCK_WINDOW, 1);

        $.blockchain.getBlockAt(tailHeight).then(tailBlock => {
            let averageBlockTime;
            if (tailBlock) {
                averageBlockTime =
                    (head.timestamp - tailBlock.timestamp) / (Math.max(head.height - tailBlock.height, 1));
            } else {
                averageBlockTime = 'unknown';
            }
            self.props.nimiqActions.updateAverageBlockTime(averageBlockTime.toFixed(2) + 's')
        });

        $.blockchain.getBlock(head.prevHash).then(prevBlock => {
            var lastBlockTime = (prevBlock ? (head.timestamp - prevBlock.timestamp) : 0).toFixed(2) + 's';
            self.props.nimiqActions.updateLastBlockTime(lastBlockTime)
        });
    }

    _getGlobalHashrate = (raw = false) => {
        const nBits = $.blockchain.head.header.nBits;
        const difficulty = window.Nimiq.BlockUtils.compactToDifficulty(nBits);
        if (raw) {
            return difficulty * Math.pow(2, 16) / window.Nimiq.Policy.BLOCK_TIME;
        } else {
            return this._setHashrate(difficulty * Math.pow(2, 16) / window.Nimiq.Policy.BLOCK_TIME);
        }
    };

    _setHashrate(hashrate) {
        let steps = ["k", "M", "G", "T", "P", "E"]; // kilo, mega, giga, tera, peta, exa
        let prefix = "";
        for (let i = 0, step; (step = steps[i]); ++i) {
            if (hashrate / 1000 < 1) {
                break;
            } else {
                hashrate /= 1000;
                prefix = step;
            }
        }
        let unit = prefix + "H/s";
        return hashrate.toFixed(2) + " " + unit;
    }

    _pendingTransactionConfirmed = () => {
        const {nimiqActions} = this.props
        // if (_pendingInterval) {
        //     clearInterval(_pendingInterval);
        // }
        var transaction = this.props.nimiq.pendingTransaction;
        nimiqActions.updatePendingTransaction(null);
        //this.props.nimiqActions.updateTransaction({estimatedTime: null});

        // this.setState({
        //     isSending: false
        // })

        $.blockchain.getBlockAt(transaction._validityStartHeight).then((block) => {
            var _recipient = transaction.recipient.toUserFriendlyAddress();
            var _sender = transaction.sender.toUserFriendlyAddress();
            nimiqActions.addPendingTransaction({
                sender: _sender,
                recipient: _recipient,
                value: Nimiq.Policy.satoshisToCoins(transaction.value),
                fee: Nimiq.Policy.satoshisToCoins(transaction.fee),
                data: Nimiq.BufferUtils.toHex(transaction.data),
                blockHeight: block.height,
                hash: transaction.hash().toHex(),
                timestamp: block.timestamp
            })
        })
    }

    _onPeersChanged = () => {
        this.props.nimiqActions.updatePeers({
            total: $.network.peerCount,
            ws: $.network.peerCountWebSocket,
            rtc: $.network.peerCountWebRtc
        });
    };

    _onMinerStarted = () => {
        window.localStorage.setItem('upTime', JSON.stringify({start: moment().unix(), end: null}))
        this.props.nimiqActions.updateMessage("");
        this.props.nimiqActions.toggleMining(true);
    };

    _onMinerStopped = () => {
        var upTime = JSON.parse(window.localStorage.getItem('upTime'));
        upTime.end = moment().unix();
        window.localStorage.setItem('upTime', JSON.stringify(upTime))
        this.props.nimiqActions.toggleMining(false);
    };

    _onBlockMined = block => {
        const {nimiq} = this.props;
        let _walletsArr = [];
        _.each(nimiq.wallets, (_wallet) => {
            _walletsArr.push(_wallet._wlt._address.toUserFriendlyAddress())
        })
       if (!(_walletsArr.indexOf(block.minerAddr.toUserFriendlyAddress()) >= 0)) return;

       this.props.nimiqActions.addMinedBlock({height: block.height, addr: block.minerAddr.toUserFriendlyAddress()})

        const txFees = block.body.transactions.reduce((sum, tx) => sum + tx.fee, 0);
       this.props.nimiqActions.addNim({nim: Nimiq.Policy.satoshisToCoins(txFees + Nimiq.Policy.blockRewardAt(block.height)), addr: block.minerAddr.toUserFriendlyAddress()})
    };

    _onHashrateChanged() {
        this._onExpectedHashTimeChanged();
    }

    _onExpectedHashTimeChanged() {
        const globalHashRate = this._getGlobalHashrate(true);
        const myWinProbability = $.miner.hashrate / globalHashRate;
        this.props.nimiqActions.updateHashRate({
            hashRate: this._setHashrate($.miner.hashrate),
            globalHashRate: this._setHashrate(globalHashRate)
        });
        const expectedHashTime = 1 / myWinProbability * window.Nimiq.Policy.BLOCK_TIME;
        this.props.nimiqActions.updateExpectedBlockReward(expectedHashTime);
    }

    _onConsensusSyncing() {
        this.props.nimiqActions.updateMessage("Synchronizing...");
    }

    _updateSyncProgress(state) {
        //if (!$.consensus.established) {
        var msg = "";
        switch (state) {
            case "sync-chain-proof":
                msg = "Downloading chain...";
                break;
            case "verify-chain-proof":
                msg = "Verifying chain...";
                break;
            case "sync-accounts-tree":
                msg = "Downloading Accounts...";
                break;
            case "verify-accounts-tree":
                msg = "Verifying Accounts...";
                break;
            case "sync-finalize":
                msg = "Synchronization Complete";
                break;
            default:
                msg = "Connecting";
                break;
        }
        this.props.nimiqActions.updateMessage(msg);
        //}
    }

    _onTxsProcessed = () => {
        console.log('_onTxsProcessed >>>')
        const {nimiq} = this.props;
        if (nimiq.pendingTransaction) {
            if (!$.mempool.getTransaction(nimiq.pendingTransaction._hash)) {
                this._pendingTransactionConfirmed();
            }
        }

        if (nimiq.receivingTransaction) {
            if (!$.mempool.getTransaction(nimiq.receivingTransaction._hash)) {
                this._receivingTransactionConfirmed();
            }
        }
    };

    _receivingTransactionConfirmed = () => {
        var transaction = this.props.nimiq.receivingTransaction;
        this.props.nimiqActions.updateReceivingTransaction(null)
        $.blockchain.getBlockAt(transaction._validityStartHeight).then((block) => {
            var _recipient = transaction.recipient.toUserFriendlyAddress();
            var _sender = transaction.sender.toUserFriendlyAddress();
            this.props.nimiqActions.addReceivingTransaction({
                sender: _sender,
                recipient: _recipient,
                value: Nimiq.Policy.satoshisToCoins(transaction.value),
                fee: Nimiq.Policy.satoshisToCoins(transaction.fee),
                data: Nimiq.BufferUtils.toHex(transaction.data),
                blockHeight: block.height,
                hash: transaction.hash().toHex(),
                timestamp: block.timestamp
            })
        })
    }

    _onTxReceived = tx => {
        const {nimiq, nimiqActions} = this.props;

        let _walletsArr = [];
        _.each(nimiq.wallets, (_wallet) => {
            _walletsArr.push(_wallet._wlt._address.toUserFriendlyAddress())
        })

        if (!(_walletsArr.indexOf(tx.recipient.toUserFriendlyAddress()) >= 0)) return;

        nimiqActions.addMessage({
            text: 'Nimiq received'
        })
        // if (_receivingInterval) {
        //     clearInterval(_receivingInterval);
        // }
        //
        this.props.nimiqActions.updateReceivingTransaction(tx)
        //
        // this._getEstimatedTime(function (_estimatedTime) {
        //     self.setState({
        //         estimatedTime: _estimatedTime
        //     })
        // });
        //
        // _receivingInterval = setInterval(() => {
        //     this.setState({
        //         elapsedTime: this.state.elapsedTime += 1
        //     })
        // }, 1000);
    };

    startMiner = (address) => {
        $.miner = new Nimiq.Miner($.blockchain, $.accounts, $.mempool, $.network.time, address);
        if (window.localStorage.getItem("threadCount")) {
            this.props.nimiqActions.updateThreadCount(window.localStorage.getItem("threadCount"));
        } else {
            var threadCount = navigator.hardwareConcurrency / 2 || 4;
            this.props.nimiqActions.updateThreadCount(threadCount);
            $.miner.threads = threadCount;
            window.localStorage.setItem("threadCount", JSON.stringify(threadCount));
        }

        $.miner.on("start", () => this._onMinerStarted());
        $.miner.on("stop", () => this._onMinerStopped());
        $.miner.on("block-mined", block => this._onBlockMined(block));
        $.miner.on("hashrate-changed", () => this._onHashrateChanged());
    }

    _addWallet() {
        let wallet;
        Nimiq.Wallet.generate()
            .then(wlt => {
                wallet = wlt;
                return $.walletStore.put(wallet);
            })
            .then(() => $.walletStore.list())
            .then(walletAddresses => {
                if (walletAddresses.length === 1) {
                    this.setAddresses(walletAddresses)
                    return $.walletStore.setDefault(walletAddresses[0]);
                }
                return Promise.resolve();
            })
    }

    setAddresses = (addresses) => {
        let self = this;
        var _addressPromises = [];
        var wallets = JSON.parse(localStorage.getItem('wallets'));
        _.each(addresses, (address) => {
            var existingWallet = _.find(wallets, (wallet) => {
                return wallet.address === address.toUserFriendlyAddress()
            })
            _addressPromises.push($.accounts.get(address).then((_accountObj) => {
                return $.walletStore.get(address).then((wlt) => {
                    var _account = {
                        name: existingWallet ? existingWallet.name : '',
                        address: address.toUserFriendlyAddress(),
                        balance: Nimiq.Policy.satoshisToCoins(_accountObj.balance),
                        _wlt: wlt,
                        transactions: [],
                        minedBlocks: []
                    }
                    db.blocks
                        .where('minerAddr')
                        .equals(address.toUserFriendlyAddress())
                        .each(function (block) {
                            _account.minedBlocks.push(block.blockHeight)
                        });
                    return $.blockchain.getTransactionReceiptsByAddress(address).then((transactions) => {
                        if (transactions.length > 0) {
                            _.each(transactions, (transaction) => {
                                $.consensus.blockchain.getBlock(transaction.blockHash).then((block) => {
                                    _.each(block.body.transactions, (transaction) => {
                                        var _recipient = transaction.recipient.toUserFriendlyAddress();
                                        var _sender = transaction.sender.toUserFriendlyAddress();
                                        var currentAddress = address.toUserFriendlyAddress();
                                        if (_recipient === currentAddress || _sender === currentAddress) {
                                            _account.transactions.push({
                                                sender: _sender,
                                                recipient: _recipient,
                                                value: Nimiq.Policy.satoshisToCoins(transaction.value),
                                                fee: Nimiq.Policy.satoshisToCoins(transaction.fee),
                                                data: Nimiq.BufferUtils.toHex(transaction.data),
                                                blockHeight: block.height,
                                                hash: transaction.hash().toHex(),
                                                timestamp: block.timestamp
                                            })
                                        }
                                    })
                                })
                            })
                            return _account;
                        } else {
                            return _account;
                        }
                    })
                })
            }))
        })

        Promise.all(_addressPromises).then(promiseResults => {
            self.props.nimiqActions.setWallets(promiseResults)
            self.props.nimiqActions.setSelectedWallet(promiseResults[0])
        })

    }

    _startInstance() {
        let self = this;
        return new Promise(resolve => {
            Nimiq.init(() => {
                window.$ = $;
                $.clientType = this.clientType;
                Promise.all([
                    Nimiq.Consensus['full'](),
                    new Nimiq.WalletStore()
                ]).then(promiseResults => {
                    $.consensus = promiseResults[0];

                    // XXX Legacy API
                    $.blockchain = $.consensus.blockchain;
                    $.mempool = $.consensus.mempool;
                    $.network = $.consensus.network;

                    $.accounts = $.blockchain.accounts;

                    $.walletStore = promiseResults[1];
                    $.network.connect();

                    $.walletStore.list().then(addresses => {
                        this.setAddresses(addresses)
                    });

                    $.consensus.on("established", () => this._onConsensusEstablished());
                    $.consensus.on("lost", () => this.props.nimiqActions.updateConsensus(false));
                    // $.consensus.on("sync-chain-proof", () => this._updateSyncProgress("sync-chain-proof"));
                    // $.consensus.on("verify-chain-proof", () => this._updateSyncProgress("verify-chain-proof"));
                    // $.consensus.on("sync-accounts-tree", () => this._updateSyncProgress("sync-accounts-tree"));
                    // $.consensus.on("verify-accounts-tree", () => this._updateSyncProgress("verify-accounts-tree"));
                    // $.consensus.on("sync-finalize", () => this._updateSyncProgress("sync-finalize"));

                    $.blockchain.on("head-changed", () => this._onHeadChanged());
                    $.network.on("peers-changed", () => this._onPeersChanged());

                    $.mempool.on("transaction-added", tx => self._onTxReceived(tx));
                    $.mempool.on("transactions-ready", () => self._onTxsProcessed());

                    resolve($);
                });
            }, function (code) {
                switch (code) {
                    case Nimiq.ERR_WAIT:
                        console.log('error wait')
                        break;
                    case Nimiq.ERR_UNSUPPORTED:
                        alert('Browser not supported');
                        break;
                    default:
                        alert('Nimiq initialization error');
                        break;
                }
            });
        });
    }

    render() {
        const {nimiq} = this.props
        return (
            <FullHeight>
                <Messages />
                {!nimiq.isConsensusEstablished && <Loading/>}
                {nimiq.isConsensusEstablished && !nimiq.setupComplete && <Setup/>}
                {nimiq.isConsensusEstablished && nimiq.setupComplete && <Drawer/>}
            </FullHeight>
        );
    }
}

function mapStateToProps(state) {
    return {
        nimiq: state.nimiq
    };
}

function mapPropsToDispatch(dispatch) {
    return {
        nimiqActions: bindActionCreators(nimiqActions, dispatch)
    };
}

export default connect(mapStateToProps, mapPropsToDispatch)(App);
