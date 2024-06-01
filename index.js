const qs = require("qs");
const Web3 = require("web3");
const BigNumber = require('bignumber.js');

let currentTrade = {};
let currentSelectSide;

//init function
async function init(){
    await listAvailableTokens();
}

//function to get list of tokens from CoinGecko
async function listAvailableTokens(){
    console.log("Initializing..");
    let response = await fetch("https://tokens.coingecko.com/uniswap/all.json");

    //get the list in JSON format
    let tokenJSONList = await response.json();
    console.log("List of all the tokens : ",tokenJSONList);

    let tokens = tokenJSONList.tokens;
    let parent = document.getElementById("token_list");

    for(const i in tokens){
        let div = document.createElement("div");
        div.className = "token_row";
        let html = `
            <img class="token_list_img" src="${tokens[i].logoURI}">
            <span class="token_list_text">${tokens[i].symbol}</span>
        `;
        div.innerHTML = html;
        div.onclick = () =>{
            selectToken(tokens[i]);
        }
        parent.appendChild(div);
    }
}

//function to select the token to display on the swap
async function selectToken(token){
    closeModal();
    currentTrade[currentSelectSide] = token;
    console.log("Current trade : ",currentTrade);
    renderInterface();
}

//function to show the token image and symbol on selecting it
function renderInterface(){
    if(currentTrade.from){
        document.getElementById("from_token_img").src = currentTrade.from.logoURI;
        document.getElementById("from_token_text").innerHTML = currentTrade.from.symbol;
    }
    if(currentTrade.to){
        document.getElementById("to_token_img").src = currentTrade.to.logoURI;
        document.getElementById("to_token_text").innerHTML = currentTrade.to.symbol;
    }
}

//function to connect the DApp to Metamask
async function connect(){
    if(typeof window.ethereum !== "undefined"){
        try {
            await window.ethereum.request({method:"eth_requestAccounts"});
            document.getElementById("login_button").innerHTML = "Connected";
            document.getElementById("swap_button").disabled = false;
        }catch(error) {
            console.error(error);
        }
    }
    else{
        document.getElementById("login_button").innerHTML = "Please install Metamask"
    }
}

//calling the init function
init();

//function to open the token selecting modal
function openModal(side){
    currentSelectSide = side;
    document.getElementById("token_modal").style.display = "block";
}

//function to close the token selecting modal
function closeModal(){
    document.getElementById("token_modal").style.display = "none";
}

//getting the price as soon as the user leaves the swap box
async function getPrice(){
    if(!currentTrade.from || !currentTrade.to || !document.getElementById("from_amount").value) return;
    let amount = Number(document.getElementById("from_amount").value* 10 ** currentTrade.from.decimals);

    //constructing the params for the query
    let params = {
        sellToken:currentTrade.from.address,
        buyToken:currentTrade.to.address,
        sellAmount:amount
    }

    //api key headers
    const headers = {"0x-api-key": "60c93077-1111-420a-91cf-26bedaccdb79"};
    
    //fetch the swap price
    const response = await fetch(`https://api.0x.org/swap/v1/price?${qs.stringify(params)}`, { headers:headers });

    let swapPriceJSON = await  response.json();
	console.log("Price: ", swapPriceJSON);
	document.getElementById("to_amount").value = swapPriceJSON.buyAmount / (10 ** currentTrade.to.decimals);
	document.getElementById("gas_estimate").innerHTML = swapPriceJSON.estimatedGas;
}

//get the official quote to swap -> needs the address
async function getQuote(account){
    if(!currentTrade.from || !currentTrade.to || !document.getElementById("from_amount").value) return;
    let amount = Number(document.getElementById("from_amount").value* 10 ** currentTrade.from.decimals);

    //constructing the params for the query
    let params = {
        sellToken:currentTrade.from.address,
        buyToken:currentTrade.to.address,
        sellAmount:amount,
        takerAddress:account
    }

    //api key headers
    const headers = {"0x-api-key": "<0x-api-key>"};
    
    //fetch the swap quote
    const response = await fetch(`https://api.0x.org/swap/v1/quote?${qs.stringify(params)}`, { headers:headers });

    let swapQuoteJSON = await  response.json();
	console.log("Quote: ", swapQuoteJSON);
	document.getElementById("to_amount").value = swapQuoteJSON.buyAmount / (10 ** currentTrade.to.decimals);
	document.getElementById("gas_estimate").innerHTML = swapQuoteJSON.estimatedGas;

    return swapQuoteJSON;
}

//try swapping after approving the transfer of ERC20 tokens
async function trySwap(){
    try {
        let accounts = await window.ethereum.request({method : "eth_accounts"});
        let takerAddress = accounts[0];

        console.log("Taker address : ", takerAddress);
        const swapQuoteJSON = await getQuote(takerAddress);

        //interacting with the ERC20 token contract
        const web3 = new Web3(Web3.givenProvider);
        const fromTokenAddress = currentTrade.from.address;
        const erc20abi= [{ "inputs": [ { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "string", "name": "symbol", "type": "string" }, { "internalType": "uint256", "name": "max_supply", "type": "uint256" } ], "stateMutability": "nonpayable", "type": "constructor" }, { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "spender", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" } ], "name": "Approval", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" } ], "name": "Transfer", "type": "event" }, { "inputs": [ { "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" } ], "name": "allowance", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "approve", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "account", "type": "address" } ], "name": "balanceOf", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "burn", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "account", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "burnFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "decimals", "outputs": [ { "internalType": "uint8", "name": "", "type": "uint8" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "subtractedValue", "type": "uint256" } ], "name": "decreaseAllowance", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "addedValue", "type": "uint256" } ], "name": "increaseAllowance", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "name", "outputs": [ { "internalType": "string", "name": "", "type": "string" } ], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "symbol", "outputs": [ { "internalType": "string", "name": "", "type": "string" } ], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "totalSupply", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "recipient", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "transfer", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "sender", "type": "address" }, { "internalType": "address", "name": "recipient", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "transferFrom", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" }]
        const ERC20TokenContract = new web3.eth.Contract(erc20abi, fromTokenAddress);
        console.log("Setting up ERC20 contract : ",ERC20TokenContract);

        //setting up the allowance
        const maxApproval = new BigNumber(2).pow(256).minus(1); 
        console.log("Approval amount : ",maxApproval);

        //grant an allowance target to spend our tokens 
        await ERC20TokenContract.methods.approve(
            swapQuoteJSON.allowanceTarget,
            maxApproval,
        )
        .send({ from: takerAddress })
        .then(tx => {
            console.log("tx: ", tx)
        });

        //getting the transaction receipt
        const receipt = await web3.eth.sendTransaction(swapQuoteJSON);
        console.log("Transaction receipt : ", receipt);
    }catch(error){
        console.error("Error while trying swap : ",error);
    }
}

//listening for events on the HTML page
document.getElementById("login_button").onclick = connect;
document.getElementById("from_token_select").onclick = () => {
    openModal("from");
};
document.getElementById("to_token_select").onclick = () => {
    openModal("to");
};
document.getElementById("modal_close").onclick = closeModal;
document.getElementById("from_amount").onblur = getPrice;
document.getElementById("swap_button").onclick = trySwap;