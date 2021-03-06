import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from 'material-ui/styles';
import Typography from 'material-ui/Typography';
import {connect} from "react-redux";
import {bindActionCreators} from "redux";
import {actions as nimiqActions} from "../../ducks/nimiq";
import Card, { CardContent } from 'material-ui/Card';
import { FormControlLabel, FormGroup, FormControl } from 'material-ui/Form';
import Switch from 'material-ui/Switch';
import Grid from 'material-ui/Grid';
import { translate } from 'react-i18next';
import Input, { InputLabel } from 'material-ui/Input';
import Select from 'material-ui/Select';
import { MenuItem } from 'material-ui/Menu';
import TextField from 'material-ui/TextField';
import { compose } from 'recompose';
import moment from 'moment';
import _ from 'lodash';
import 'moment-duration-format';

const styles = theme => ({
    card: {
        minWidth: 275,
    },
    bullet: {
        display: 'inline-block',
        margin: '0 2px',
        transform: 'scale(0.8)',
    },
    title: {
        marginBottom: 16,
        fontSize: 14,
        color: theme.palette.text.secondary,
    },
    pos: {
        marginBottom: 12,
        color: theme.palette.text.secondary,
    },
    textField: {
        marginLeft: 15
    }
});

var countUpInterval;

class Mining extends React.Component {

    state = {
        checkedA: true,
        miningWallet: null,
        upTime: {
            start: null,
            end: null
        },
        countUp: null
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.nimiq.wallets !== this.props.nimiq.miningWallet) {
            this.miningWalletTotal()
        }
    }

    componentWillMount() {
        const { nimiq } = this.props;
        const miningWallet = JSON.parse(localStorage.getItem('miningWallet'))
        if (miningWallet) {
            this.setState({
                miningWallet: miningWallet
            })
        } else {
            this.setState({
                miningWallet: nimiq.wallets[0].address
            }, () => {
                this.setMiningWallet(nimiq.wallets[0].address)
            })
        }

        this.checkUpTime()
    }

    checkUpTime = () => {
        console.log('checkUpTime >>>')
        var _upTime = JSON.parse(window.localStorage.getItem('upTime'))
        if (_upTime) {
            console.log('_upTime ', _upTime)
            this.setState({
                upTime: _upTime
            }, () => {
                if (_upTime.start && !_upTime.end) {
                    this.startCountUp()
                }
            })
        }
    }

    startCountUp = () => {
        if (!countUpInterval) {
            countUpInterval = setInterval(() => {
                console.log((moment().unix() - this.state.upTime.start))
                this.setState({
                    countUp: moment.duration((moment().unix() - this.state.upTime.start), "seconds").format("h [hrs], m [min], s [sec]")
                })
            }, 1000)
        }
    }

    toggleMining = (checked) => {
        this.props.nimiqActions.toggleMining(checked);

        if (!checked) {
           clearInterval(countUpInterval)
           countUpInterval = '';
        }

        setTimeout(() => {
            this.checkUpTime()
        }, 1000)
    }

    totalAllWallets = () => {
        var total = 0;
        _.each(this.props.nimiq.wallets, (wallet) => {
            total += wallet.minedBlocks.length
        })

        return total;
    }

    miningWalletTotal = () => {
        var _miningWallet = this.props.nimiq.miningWallet || JSON.parse(localStorage.getItem('miningWallet'));
        console.log('_miningWallet ', _miningWallet)
        if (_miningWallet) {
            var miningWallet = _.find(this.props.nimiq.wallets, (wallet) => {
                console.log(wallet.address, _miningWallet)
                return wallet.address === _miningWallet
            })

            console.log('miningWallet ', miningWallet)

            if (miningWallet) {
                return miningWallet.minedBlocks.length
            } else {
                return 0
            }
        } else {
            return 0
        }
    }

    handleMiningWalletChange = (e) => {
        this.setState({
            miningWallet: e.target.value
        }, () => {
            this.setMiningWallet(e.target.value)
        })
    }

    setMiningWallet (address) {
        this.toggleMining(false)
        this.props.nimiqActions.setMiningWallet(Nimiq.Address.fromUserFriendlyAddress(address))
        localStorage.setItem('miningWallet', JSON.stringify(address))
    }

    handleThreadCount = (e) => {
        this.props.nimiqActions.updateThreadCount(e.target.value);
    }

    render() {
        const { nimiq, classes, t } = this.props;
        const {miningWallet, upTime, countUp} = this.state;
        return (
            <div style={{padding: 30}}>
                <Typography variant="headline" component="h2" style={{marginBottom: 15, float: 'left'}}>
                    {t('mining.title')}
                </Typography>
                <Grid container>
                    <Grid item xs={12}>
                        <FormControl className={classes.formControl}>
                            <InputLabel htmlFor="mining-wallet">{t('mining.miningWallet')}</InputLabel>
                            <Select
                                value={miningWallet}
                                onChange={this.handleMiningWalletChange}
                                input={<Input name="mining-wallet" id="mining-wallet" />}
                                style={{width: 300}}
                            >
                                {nimiq.wallets.map((wallet, index) => (
                                    <MenuItem value={wallet.address} key={index}>
                                        {wallet.name ? wallet.name : `Wallet ${index + 1}`}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            id="number"
                            label="Threads"
                            value={nimiq.threadCount}
                            onChange={this.handleThreadCount}
                            type="number"
                            className={classes.textField}
                            InputLabelProps={{
                                shrink: true,
                            }}
                            margin="normal"
                        />
                        <FormGroup style={{float:'right', marginTop: 20}}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={nimiq.isMining}
                                        onChange={(event, checked) => this.toggleMining(checked)}
                                    />
                                }
                                label={t('mining.toggle')}
                            />
                        </FormGroup>
                    </Grid>
                </Grid>
                <Grid container>
                    <Grid item xs={4}>
                        <Card className={classes.card}>
                            <CardContent>
                                <Typography className={classes.title}>{t('mining.hashRate')}</Typography>
                                <Typography variant="headline" component="h2">
                                    {nimiq.hashRate}
                                </Typography>
                                <Typography className={classes.pos}>{t('mining.global')}: {nimiq.globalHashRate}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={4}>
                        <Card className={classes.card}>
                            <CardContent>
                                <Typography className={classes.title}>{t('mining.lastBlockTime')}</Typography>
                                <Typography variant="headline" component="h2">
                                    {nimiq.lastBlockTime}
                                </Typography>
                                <Typography className={classes.pos}>{t('mining.average')}: {nimiq.averageBlockTime}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={4}>
                        <Card className={classes.card}>
                            <CardContent>
                                <Typography className={classes.title}>Peers</Typography>
                                <Typography variant="headline" component="h2">
                                    {nimiq.peers.total}
                                </Typography>
                                <Typography className={classes.pos}>{nimiq.peers.ws} {t('mining.nodes')} / {nimiq.peers.rtc} {t('mining.clients')}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
                <Grid container>
                    <Grid item xs={4}>
                        <Card className={classes.card}>
                            <CardContent>
                                <Typography className={classes.title}>{t('mining.totalBlocksMined')}</Typography>
                                <Typography variant="headline" component="h2">
                                    {this.miningWalletTotal()}
                                </Typography>
                                <Typography className={classes.pos}>Total All Wallets: {this.totalAllWallets()}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={4}>
                        <Card className={classes.card}>
                            <CardContent>
                                <Typography className={classes.title}>{t('mining.estimatedBlocks')}</Typography>
                                <Typography variant="headline" component="h2">
                                    {((60 * 60 * 24) / nimiq.expectedBlockReward).toFixed(2)} per day
                                </Typography>
                                <Typography className={classes.pos}>{((60 * 60 * 24 * 30) / nimiq.expectedBlockReward).toFixed(2)} per month</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={4}>
                        <Card className={classes.card}>
                            <CardContent>
                                <Typography className={classes.title}>{t('mining.upTime')}</Typography>
                                <Typography variant="headline" component="h2">
                                    {countUp}
                                </Typography>
                                <Typography className={classes.pos}>Since: {moment.unix(upTime.start).format('MMMM Do YYYY, h:mm:ss a')}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </div>
        );
    }
}

Mining.propTypes = {
    classes: PropTypes.object.isRequired,
};

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

export default compose(
    connect(mapStateToProps, mapPropsToDispatch),
    withStyles(styles),
    translate('translations')
)(Mining);