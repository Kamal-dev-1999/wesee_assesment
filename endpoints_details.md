
This documentation describes the functionality of the Trix API Gateway.

-----

### **`GET /health`**

  * **Use Case:** A simple health check to confirm that the backend server is running, connected to the correct network, and has its wallet address loaded.
  * **Request Body:** None.
  * **Success Response (Example):**
    ```json
    {
      "status": "healthy",
      "timestamp": "2025-08-13T07:30:00.000Z",
      "network": "http://127.0.0.1:8545",
      "backendAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    }
    ```

-----

### **`GET /balance/:address`**

  * **Use Case:** Fetches the current `GT` (Game Token) balance for any given wallet address.
  * **Request Params:** The user's wallet address is passed in the URL.
  * **Success Response (Example):**
    ```json
    {
      "address": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      "balance": "150.0",
      "rawBalance": "150000000000000000000"
    }
    ```

-----

### **`GET /rate`**

  * **Use Case:** Retrieves the current conversion rate from USDT to GT as defined in the `TokenStore` contract.
  * **Request Body:** None.
  * **Success Response (Example):**
    ```json
    {
      "gtPerUsdt": "1.0"
    }
    ```

-----

### **`POST /add-dummy-usdt` (Testing Only)**

  * **Use Case:** A helper endpoint for testing purposes. It sends a specified amount of mock USDT from the deployer's wallet to any address.
  * **Request Body:**
    ```json
    {
      "address": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      "amount": "50"
    }
    ```
  * **Success Response (Example):**
    ```json
    {
      "message": "USDT added successfully",
      "address": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      "usdtAmount": "50.0",
      "newBalance": "150.0",
      "transactionHash": "0x..."
    }
    ```

-----

### **`POST /give-backend-usdt` (Testing Only)**

  * **Use Case:** A helper endpoint to fund the backend's own wallet with mock USDT for testing contract interactions.
  * **Request Body:**
    ```json
    {
      "amount": "1000"
    }
    ```
  * **Success Response (Example):**
    ```json
    {
        "message": "USDT given to backend successfully",
        "backendAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "usdtAmount": "1000.0",
        "newBackendBalance": "1000.0",
        "transactionHash": "0x..."
    }
    ```

-----

### **`POST /purchase` (Testing Only)**

  * **Use Case:** Facilitates the purchase of GT tokens. In this testing implementation, the backend uses its own USDT to buy GT from the `TokenStore` and then transfers the newly minted GT to the user.
  * **Request Body:**
    ```json
    {
      "address": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      "usdtAmount": "25"
    }
    ```
  * **Success Response (Example):**
    ```json
    {
      "message": "GT tokens purchased successfully",
      "address": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      "usdtSpent": "25.0",
      "gtReceived": "25.0",
      "newGTBalance": "25.0",
      "transactionHash": "0x...",
      "note": "Purchase completed via TokenStore using backend USDT (testing mode)"
    }
    ```

-----

### **`POST /match/start`**

  * **Use Case:** Creates and initializes a new match on the `PlayGame` smart contract. This is an administrative action performed only by the backend wallet.
  * **Request Body:**
    ```json
    {
      "matchId": "match-123",
      "player1": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      "player2": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      "stake": "10"
    }
    ```
  * **Success Response (Example):**
    ```json
    {
      "message": "Match created successfully",
      "matchId": "match-123",
      "hashedMatchId": "0x...",
      "player1": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      "player2": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      "stake": "10.0",
      "transactionHash": "0x..."
    }
    ```

-----

### **`POST /match/stake` (Hardhat Testing Only)**

  * **Use Case:** Allows a player to stake their GT into a pre-existing match. This endpoint uses Hardhat's `impersonateAccount` feature and is not for production use.
  * **Request Body:**
    ```json
    {
        "matchId": "match-123",
        "player": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"
    }
    ```
  * **Success Response (Example):**
    ```json
    {
        "message": "Stake successful",
        "matchId": "match-123",
        "player": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        "stake": "10.0",
        "approvalTx": null,
        "stakeTx": "0x...",
        "matchStatus": "STAKED",
        "player1Staked": true,
        "player2Staked": true
    }
    ```

-----

### **`POST /match/result`**

  * **Use Case:** Submits the final result of a match to the `PlayGame` contract, triggering the payout to the winner. This is an administrative action.
  * **Request Body:**
    ```json
    {
      "matchId": "match-123",
      "winner": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"
    }
    ```
  * **Success Response (Example):**
    ```json
    {
      "message": "Match result committed successfully",
      "matchId": "match-123",
      "hashedMatchId": "0x...",
      "winner": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      "transactionHash": "0x..."
    }
    ```

-----

### **`GET /match/:matchId`**

  * **Use Case:** Retrieves the full, raw on-chain details for a specific match from the `PlayGame` contract.
  * **Request Params:** The `matchId` (e.g., "match-123") is passed in the URL.
  * **Success Response (Example):**
    ```json
    {
        "matchId": "match-123",
        "hashedMatchId": "0x...",
        "player1": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        "player2": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "stake": "10.0",
        "status": "SETTLED",
        "statusCode": 2,
        "startTime": "1691910000",
        "player1Staked": true,
        "player2Staked": true
    }
    ```

-----

### **`GET /match/summary/:matchId`**

  * **Use Case:** Retrieves match details and provides a clear `decision` field indicating the next logical action (e.g., if the match is ready for a result to be posted).
  * **Request Params:** The `matchId` is passed in the URL.
  * **Success Response (Example):**
    ```json
    {
        "matchId": "match-123",
        "exists": true,
        "player1": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        "player2": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "stake": "10.0",
        "status": "STAKED",
        "statusCode": 1,
        "player1Staked": true,
        "player2Staked": true,
        "bothPlayersStaked": true,
        "decision": "READY: both players staked, you can post result"
    }
    ```