class PermissionsError extends Error {
    constructor(permission, original) {
        super("Missing Permission: " + permission);
        this.name = this.constructor.name;
        this.permission = permission;
        this.original = original;
        Error.captureStackTrace(this, this.constructor);
    }
}

class EmptyError extends Error {
    constructor() {
        super("Cannot Send Empty Message");
    }
}

module.exports = { PermissionsError, EmptyError };