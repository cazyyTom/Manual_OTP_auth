class ApiError extends Error {
    constructor(message, statusCode,stack= "", errors= []) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.success = false;
        this.errors = errors;
        if(stack){
            this.stack = stack;
        } else{
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
export default ApiError;