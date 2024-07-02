const axios = require("axios")

const JWTHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${process.env.graphqlJwt}`
}

class NccDatasource {
  constructor() {
    this.endpoints = JSON.parse(process.env.graphqlEndpoints)
    console.log(this.endpoints)
  }
  async getAccountState(address, endpointIndex=0) {
    let endpoint = this.endpoints[endpointIndex]
    try {
      let {data} = await axios.create({timeout: 10000})({
        method: 'POST',
        url: endpoint,
        headers: JWTHeaders,
        data: {
          "variables":{"address": address},
          "query":`
          query getAgent($address: Address!) {
            goldBalance(address: $address)
            stateQuery {
              agent(address: $address) {
                avatarStates {
                  actionPoint,
                  address,
                  blockIndex,
                  characterId,
                  dailyRewardReceivedIndex,
                  ear,
                  exp
                  hair
                  lens
                  level
                  name
                  tail
                  updatedAt
                  inventory {
                    equipments {
                      id
                      itemSubType
                      equipped
                    }
                  }
                }
              }
            }
          }
          `
        }
      })

      let goldBalance = data['data']['goldBalance']
      let agent = data['data']['stateQuery']['agent']
      let rows = []
      if (agent) {
        for (let avatar of agent['avatarStates']) {
          if (avatar && avatar.inventory && avatar.inventory.equipments && avatar.inventory.equipments.length > 0) {
            avatar.inventory.equipments = avatar.inventory.equipments.filter(({equipped}) => equipped)
          }
          rows.push({
            type: 'AVATAR',
            address: address.toLowerCase(),
            avatarAddress: avatar && avatar.address && avatar.address.toLowerCase(),
            avatarName: avatar && avatar.name && avatar.name.toLowerCase(),
            avatar,
            goldBalance,
          })
        }
      } else {
        //no avatar address
        rows.push({
          type: 'ACCOUNT',
          address: address.toLocaleLowerCase(),
          avatarAddress: 'NOAVATAR',
          goldBalance
        })
      }

      return rows
    } catch(e) {
    }
  }

  async getLatestBlockIndex(lastBlockIndex = 0) {
    console.time('Fetch Latest BlockIndex')
    let response = {}
    for (let endpointIndex = 0; endpointIndex < this.endpoints.length; endpointIndex++) {
      let endpoint = this.endpoints[endpointIndex]
      try {
        let {data} = await axios.create({timeout: 10000})({
          method: 'POST',
          url: endpoint,
          headers: JWTHeaders,
          data: {
            "variables":{"offset": 0},
            "query":`
          query getBlock($offset: Int!) {
            chainQuery {
              blockQuery {
                blocks(offset: $offset, limit: 1, desc:true) {
                  index
                }
              }
            }
          }
          `
          }
        })
        let latestIndex = data['data']['chainQuery']['blockQuery']['blocks'][0]['index']
        response = {latestIndex, endpointIndex}
        if (lastBlockIndex < latestIndex || (endpointIndex + 1) == this.endpoints.length) {
          break
        }
      } catch (e) {
        console.log(e)
      }
    }

    console.log('ok', response)
    console.timeEnd('Fetch Latest BlockIndex')
    return response
  }

  async fetchBlock(index, endpointIndex = 0) {
    try {
      let endpoint = this.endpoints[endpointIndex]
      console.time('Fetch Block ' + index)
      let {data} = await axios({
        method: 'POST',
        url: endpoint,
        headers: JWTHeaders,
        data: {
          "variables":{"index":index},
          "query":`
        query getBlock($index: ID!) {
          chainQuery {
            blockQuery {
              block(index:$index) {
                index
                hash
                miner
                stateRootHash
                timestamp
                transactions {
                  actions {
                    raw
                    inspection
                  }
                  id
                  nonce
                  publicKey
                  signature
                  signer
                  timestamp
                  updatedAddresses
                }
              }
            }
          }
        }
        `
        }
      })

      console.timeEnd('Fetch Block ' + index)
      return data['data']['chainQuery']['blockQuery']['block']
    } catch(e) {
      console.log(e)
    }
    return null
  }

  async getTxStatus(txId, endpointIndex = 0) {
    try {
      let endpoint = this.endpoints[endpointIndex]
      let {data} = await axios({
        method: 'POST',
        url: endpoint,
        headers: JWTHeaders,
        data: {
          "variables":{"txId":txId},
          "query":`
            query query($txId: TxId!) {
              transaction {
                transactionResult(txId: $txId) {
                  txStatus
                }
              }
            }`
        }
      })
      return data['data']['transaction']['transactionResult']['txStatus']
    } catch(e) {
      console.log(e)
    }
    return null
  }
}

module.exports = new NccDatasource()