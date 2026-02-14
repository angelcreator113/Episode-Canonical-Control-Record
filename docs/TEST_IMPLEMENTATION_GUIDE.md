# Test Implementation Guide - Pattern Reference

## Quick Reference for Adding Real Tests

### 1. Controller Test Template

```javascript
/**
 * [Controller Name] Unit Tests - REAL TEST IMPLEMENTATIONS
 */

jest.mock('../../../src/models');
jest.mock('../../../src/middleware/errorHandler');
jest.mock('../../../src/middleware/auditLog');

const controller = require('../../../src/controllers/[controllerName]');
const { models } = require('../../../src/models');
const { NotFoundError, ValidationError } = require('../../../src/middleware/errorHandler');
const { logger } = require('../../../src/middleware/auditLog');

describe('[Controller Name]', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      query: {},
      body: {},
      params: {},
      user: { id: 'user-123', 'cognito:groups': ['editor'] },
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('methodName()', () => {
    test('should perform expected action', async () => {
      // ARRANGE - Setup mocks and data
      const mockData = { id: 1, name: 'test' };
      models.Model.findAndCountAll = jest.fn().mockResolvedValue({
        count: 1,
        rows: [mockData],
      });

      mockReq.query = { page: 1 };

      // ACT - Call the controller method
      await controller.methodName(mockReq, mockRes);

      // ASSERT - Verify behavior
      expect(models.Model.findAndCountAll).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [mockData],
          pagination: expect.any(Object),
        })
      );
    });

    test('should handle missing resources', async () => {
      models.Model.findByPk = jest.fn().mockResolvedValue(null);

      mockReq.params = { id: 999 };

      await expect(
        controller.methodName(mockReq, mockRes)
      ).rejects.toThrow();
    });

    test('should log actions', async () => {
      models.Model.findAndCountAll = jest.fn().mockResolvedValue({
        count: 0,
        rows: [],
      });

      await controller.methodName(mockReq, mockRes);

      expect(logger.logAction).toHaveBeenCalledWith(
        'user-123',
        'action-type',
        'resource-type',
        'resource-id',
        expect.any(Object)
      );
    });
  });
});
```

### 2. Model Test Template

```javascript
jest.mock('../../src/config/database');

const { Episode } = require('../../src/models');

describe('[Model Name]', () => {
  test('should validate required fields', async () => {
    expect.assertions(1);

    try {
      await Episode.create({ /* missing required fields */ });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test('should create with valid data', async () => {
    const episode = {
      showName: 'Test Show',
      seasonNumber: 1,
      episodeNumber: 1,
      episodeTitle: 'Test',
    };

    const result = await Episode.create(episode);

    expect(result).toHaveProperty('id');
    expect(result.showName).toBe('Test Show');
  });

  test('should update instance', async () => {
    const episode = await Episode.create({
      showName: 'Old',
      seasonNumber: 1,
      episodeNumber: 1,
      episodeTitle: 'Test',
    });

    await episode.update({ showName: 'New' });

    expect(episode.showName).toBe('New');
  });
});
```

### 3. Middleware Test Template

```javascript
jest.mock('../../src/config/environment');

const { middlewareName } = require('../../src/middleware/[middlewareName]');

describe('[Middleware Name]', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      headers: { authorization: 'Bearer token' },
      user: null,
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  test('should attach user to request', () => {
    middlewareName(mockReq, mockRes, mockNext);

    expect(mockReq.user).toBeDefined();
    expect(mockNext).toHaveBeenCalled();
  });

  test('should reject invalid token', () => {
    mockReq.headers.authorization = 'Bearer invalid';

    middlewareName(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
  });
});
```

---

## Key Testing Patterns

### Pattern 1: List/Pagination Tests
```javascript
test('should return list with pagination', async () => {
  const mockItems = [{ id: 1 }, { id: 2 }];
  models.Model.findAndCountAll = jest
    .fn()
    .mockResolvedValue({ count: 2, rows: mockItems });

  mockReq.query = { page: 1, limit: 20 };
  await controller.listItems(mockReq, mockRes);

  expect(mockRes.json).toHaveBeenCalledWith(
    expect.objectContaining({
      data: mockItems,
      pagination: expect.objectContaining({
        page: 1,
        limit: 20,
        total: 2,
      }),
    })
  );
});
```

### Pattern 2: Filter Tests
```javascript
test('should filter by status', async () => {
  models.Model.findAndCountAll = jest
    .fn()
    .mockResolvedValue({ count: 1, rows: [{ status: 'pending' }] });

  mockReq.query = { status: 'pending' };
  await controller.listItems(mockReq, mockRes);

  expect(models.Model.findAndCountAll).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ status: 'pending' }),
    })
  );
});
```

### Pattern 3: Not Found Tests
```javascript
test('should throw NotFoundError if missing', async () => {
  models.Model.findByPk = jest.fn().mockResolvedValue(null);

  mockReq.params = { id: 999 };

  await expect(
    controller.getItem(mockReq, mockRes)
  ).rejects.toThrow();
});
```

### Pattern 4: Create Tests
```javascript
test('should create with valid data', async () => {
  const newItem = { id: 1, name: 'New Item' };
  models.Model.create = jest.fn().mockResolvedValue(newItem);

  mockReq.body = { name: 'New Item' };
  await controller.createItem(mockReq, mockRes);

  expect(models.Model.create).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'New Item' })
  );
  expect(mockRes.status).toHaveBeenCalledWith(201);
});
```

### Pattern 5: Update Tests
```javascript
test('should update item', async () => {
  const item = {
    id: 1,
    name: 'Old',
    update: jest.fn().mockResolvedValue(true),
  };
  models.Model.findByPk = jest.fn().mockResolvedValue(item);

  mockReq.params = { id: 1 };
  mockReq.body = { name: 'New' };
  await controller.updateItem(mockReq, mockRes);

  expect(item.update).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'New' })
  );
});
```

### Pattern 6: Delete Tests
```javascript
test('should delete item', async () => {
  const item = {
    id: 1,
    destroy: jest.fn().mockResolvedValue(true),
  };
  models.Model.findByPk = jest.fn().mockResolvedValue(item);

  mockReq.params = { id: 1 };
  await controller.deleteItem(mockReq, mockRes);

  expect(item.destroy).toHaveBeenCalled();
});
```

### Pattern 7: Logging Tests
```javascript
test('should log action', async () => {
  models.Model.findAndCountAll = jest
    .fn()
    .mockResolvedValue({ count: 0, rows: [] });

  await controller.listItems(mockReq, mockRes);

  expect(logger.logAction).toHaveBeenCalledWith(
    'user-123',
    'view',
    'model',
    'all',
    expect.any(Object)
  );
});
```

### Pattern 8: Error Handling Tests
```javascript
test('should handle database errors', async () => {
  models.Model.findAndCountAll = jest
    .fn()
    .mockRejectedValue(new Error('DB error'));

  await expect(
    controller.listItems(mockReq, mockRes)
  ).rejects.toThrow('DB error');
});
```

---

## Common Assertions

### For Controller Methods
```javascript
// Verify model method called
expect(models.Model.findByPk).toHaveBeenCalledWith(id);

// Verify correct response status
expect(mockRes.status).toHaveBeenCalledWith(201);

// Verify response structure
expect(mockRes.json).toHaveBeenCalledWith(
  expect.objectContaining({
    data: expect.any(Object),
    pagination: expect.any(Object),
  })
);

// Verify logging
expect(logger.logAction).toHaveBeenCalledWith(
  expect.any(String),
  expect.any(String),
  expect.any(String),
  expect.any(Object)
);
```

### For Error Cases
```javascript
// Expect exception
await expect(controller.method(req, res)).rejects.toThrow();

// Expect specific error
await expect(controller.method(req, res)).rejects.toThrow(NotFoundError);

// Verify error response
expect(mockRes.status).toHaveBeenCalledWith(404);
```

### For Data Transformations
```javascript
// Verify data structure
expect(result).toHaveProperty('id');
expect(result.name).toBe('expected');

// Verify array contents
expect(result.items).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ id: 1 }),
    expect.objectContaining({ id: 2 }),
  ])
);
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/unit/controllers/episode.test.js

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run specific test suite
npm test -- --testNamePattern="listEpisodes"
```

---

## Coverage Goals

- Controllers: 75%+ (currently 41.78%)
- Middleware: 75%+ (currently 16.61%)
- Models: 75%+ (currently 39.59%)
- Routes: 100% ✅ (currently 100%)
- Overall: 75%+ (currently 36.74%)

---

## Time Estimates

- Controller test file: 30-45 min per file (10-15 tests each)
- Middleware test file: 20-30 min per file (5-8 tests each)
- Model test file: 15-20 min per file (5-10 tests each)
- Full reach to 75%: 4-6 hours total

