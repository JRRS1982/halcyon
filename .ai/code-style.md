# Coding Guidelines

## Core Principles

- Write simple and straightforward code
- Ensure your code is easy to read and understand. Self-documenting code is preferred over comments
- Keep performance in mind but do not over-optimize at the cost of readability
- Write code that is easy to maintain and update. Keep the amount of external dependencies to a minimum
- Where functions contain complexity, make use of a high-level JSDoc comment above the function that can describe its purpose in a single line and that clarifies arguments and the return value
- Ensure your code is easy to test. Pure functions are awesome for that
- Write reusable functions when possible
- Utilize early returns when possible
- Define types when applicable
- When altering existing code, keep changes to a minimum and provide context on the proposed changes
- Don't change existing comments unless the related code changes
- Avoid cleaning up unless asked to do so specifically
- Don't add features that are not asked for

## Examples

### Early Returns

**Bad (nested if statements):**

```typescript
const processUser = ({ user }) => {
  if (user) {
    if (user.isActive) {
      if (user.hasPermission) {
        return user.process();
      } else {
        return null;
      }
    } else {
      return null;
    }
  } else {
    return null;
  }
}
```

**Good (early returns):**

```typescript
const processUser = ({ user }) => {
  if (!user) return null;
  if (!user.isActive) return null;
  if (!user.hasPermission) return null;

  return user.process();
}
```

### Self-Documenting Code

**Bad (needs comments to understand):**

```typescript
// Check if user can access
function check(u, r) {
  // If user exists and role matches
  if (u && u.r === r) {
    // Return true
    return true;
  }
  // Otherwise return false
  return false;
}
```

**Good (self-documenting):**

```typescript
function canUserAccessResource(user, requiredRole) {
  if (!user) return false;
  if (user.role !== requiredRole) return false;

  return true;
}
```

**Another example - Bad:**

```typescript
// Calculate total with discount
function calc(d, p) {
  let t = 0;
  for (let i = 0; i < p.length; i++) {
    t += p[i].price;
  }
  if (d > 0) {
    t = t - t * d;
  }
  return t;
}
```

**Good:**

```typescript
function calculateTotalWithDiscount(discountPercentage, products) {
  const subtotal = products.reduce((sum, product) => sum + product.price, 0);

  if (discountPercentage <= 0) return subtotal;

  const discountAmount = subtotal * discountPercentage;
  return subtotal - discountAmount;
}
```
