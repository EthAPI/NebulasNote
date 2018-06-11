const CONTRACT_ADDRESS = "n1psLtrTUK7NwGkhjGXSXuBb6mPRpYBRSA1";

class SmartContractApi {
    constructor(contractAdress) {
        let NebPay = require("nebpay");
        this.nebPay = new NebPay();
        this._contractAdress = contractAdress || CONTRACT_ADDRESS;
    }

    getContractAddress() {
        return this.contractAdress;
    }

    _simulateCall({
        value = "0", callArgs = "[]", callFunction, callback
    }) {
        this.nebPay.simulateCall(this._contractAdress, value, callFunction, callArgs, {
            callback: function (resp) {
                if (callback) {
                    callback(resp);
                }
            }
        });
    }

    _call({
        value = "0", callArgs = "[]", callFunction, callback
    }) {
        this.nebPay.call(this._contractAdress, value, callFunction, callArgs, {
            callback: function (resp) {
                if (callback) {
                    callback(resp);
                }
            }
        });
    }
}

class NoteContractApi extends SmartContractApi {
    add(text, cb) {
        this._call({
            callArgs: `[${Date.now()}, "${text}"]`,
            callFunction: "add",
            callback: cb
        });
    }

    update(taskId, text, cb) {
        this._call({
            callArgs: `[${taskId}, "${text}"]`,
            callFunction: "update",
            callback: cb
        });
    }

    delete(taskId, cb) {
        this._call({
            callArgs: `[${taskId}]`,
            callFunction: "delete",
            callback: cb
        });
    }

    getTotalCount(cb) {
        this._simulateCall({
            callFunction: "total",
            callback: cb
        });
    }

    get(limit, offset, cb) {
        this._simulateCall({
            callArgs: `[${limit}, ${offset}]`,
            callFunction: "get",
            callback: cb
        });
    }
}
