# Contributing to Sessh TypeScript SDK

Thank you for contributing to sessh-typescript-sdk, a promise-based TypeScript client for managing persistent SSH sessions.

## Philosophy

The TypeScript SDK is intentionally minimal:

1. **No Dependencies**: We use Node.js built-ins only (`child_process`, no external packages)
2. **Thin Wrapper**: We call `sessh` CLI and parse JSON. No SSH logic here.
3. **Fail Loudly**: If `sessh` fails, we throw errors. No silent failures.
4. **Type Safety**: We use TypeScript for type safety and better developer experience.
5. **Promise-Based**: All operations return promises for async/await usage.

## Development Setup

### Prerequisites

- Node.js 18+
- The `sessh` CLI must be installed and on PATH
- TypeScript 5.6+

### Setup

```bash
npm install
npm run build
```

### Development

```bash
# Build
npm run build

# Run tests
npm test
```

## Code Style

- Use TypeScript strict mode
- Prefer async/await over promises
- Use `spawn` from `node:child_process` for subprocess execution
- Always set `SESSH_JSON=1` in environment when calling `sessh`
- Parse JSON responses and validate structure
- Throw errors with clear messages
- Export interfaces for all public types

## Architecture

The SDK is a simple wrapper:

1. **Client initialization**: Store options (alias, host, port, etc.)
2. **Command execution**: Build `sessh` CLI args, set environment, spawn subprocess
3. **Response parsing**: Parse JSON output, return typed objects
4. **Error handling**: Throw errors on failure

Key design decisions:

- No dependencies (use Node.js built-ins)
- JSON mode forced for all calls
- Promises for async operations
- TypeScript interfaces for type safety
- Errors thrown on failure (no return codes)

## Adding Features

If `sessh` CLI adds new commands, add corresponding SDK methods:

1. Add method to `SesshClient` class:
   ```typescript
   /**
    * Description of what it does.
    */
   async newMethod(param: string): Promise<SesshResponse> {
     const args = ["newcommand", this.options.alias, this.options.host, param];
     const result = await runSessh(args, this.options);
     return parseResponse<SesshResponse>(result);
   }
   ```

2. Add/update interfaces if needed:
   ```typescript
   export interface NewMethodResponse extends SesshResponse {
     newField?: string;
   }
   ```

3. Update README.md with new method documentation

4. Add tests to `tests/index.test.ts`

## Submitting Changes

1. **Fork the repository** (if needed)

2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**:
   - Keep no dependencies (Node.js built-ins only)
   - Add type definitions
   - Add JSDoc comments
   - Write tests

4. **Build and test**:
   ```bash
   npm run build
   npm test
   ```

5. **Commit and push**:
   ```bash
   git commit -m "feat: add support for X"
   git push origin feature/your-feature-name
   ```

## Pull Request Guidelines

- **Describe the change**: What does it do? Why is it needed?
- **Show it works**: Include code examples
- **Keep it focused**: One feature or fix per PR
- **Update docs**: README.md should reflect new functionality
- **Add tests**: New features should have tests
- **Update types**: Export new interfaces if needed

## What We're Looking For

### High Priority

- **Error handling**: Better error messages, error types
- **Type safety**: More specific types, better TypeScript usage
- **Documentation**: More examples, usage patterns
- **Testing**: Better test coverage

### Nice to Have

- **Performance**: Faster subprocess execution (if possible)
- **Features**: New methods if `sessh` CLI adds commands
- **Developer experience**: Better error messages, debugging helpers

### Not Looking For

- **External dependencies**: We want to stay dependency-free
- **Sync methods**: Everything is async for a reason
- **SSH logic**: That's in `sessh` CLI, not here

## Questions?

Open an issue with the `question` label. We're happy to help!

