# FoodFlow - Distributed Food Delivery Backend

A production-grade, scalable food delivery backend inspired by Swiggy and Zomato. Built with microservices architecture, event-driven communication, and real-time order tracking.

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────────────┐
│   Client    │────▶│              API Gateway (:3000)                  │
│  (REST/WS)  │     │  Rate Limiting · JWT Auth · WebSocket · Swagger   │
└─────────────┘     └──────────┬───────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼          ▼           ▼          ▼           ▼
   Auth (:3001) User (:3002) Restaurant Order (:3004) Delivery (:3005)
                              (:3003)              Notification (:3006)
        │          │           │          │           │
        └──────────┴───────────┴──────────┴───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
         PostgreSQL          Redis            Kafka
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18, Express.js |
| Database | PostgreSQL 15 |
| Cache | Redis 7 |
| Messaging | Apache Kafka |
| Auth | JWT + Refresh Tokens |
| Real-time | Socket.IO |
| Container | Docker + Docker Compose |
| Docs | Swagger/OpenAPI |

## Services

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 3000 | Routing, rate limiting, WebSockets |
| Auth Service | 3001 | Registration, login, JWT, RBAC |
| User Service | 3002 | Profiles, addresses, cart |
| Restaurant Service | 3003 | Restaurants, menus, order acceptance |
| Order Service | 3004 | Order placement, cancellation, tracking |
| Delivery Service | 3005 | Delivery assignment, status updates |
| Notification Service | 3006 | In-app + mock email notifications |

### Authentication
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/me
```

### Users & Cart
```
GET    /api/users/profile
PUT    /api/users/profile
GET    /api/users/addresses
POST   /api/users/addresses
GET    /api/users/orders
GET    /api/cart
POST   /api/cart/items
DELETE /api/cart/items/:id
PATCH  /api/cart/items/:id
```

### Restaurants & Menu
```
GET    /api/restaurants
GET    /api/restaurants/popular
GET    /api/restaurants/:id
POST   /api/restaurants
PUT    /api/restaurants/:id
POST   /api/menu
PUT    /api/menu/:id
DELETE /api/menu/:id
GET    /api/menu/restaurant/:restaurantId
```

### Orders
```
POST   /api/orders
GET    /api/orders
GET    /api/orders/:id
PATCH  /api/orders/:id/cancel
```

### Deliveries
```
GET    /api/deliveries
GET    /api/deliveries/available
PATCH  /api/deliveries/:id/accept
PATCH  /api/deliveries/:id/status
```

### Notifications
```
GET    /api/notifications
GET    /api/notifications/unread-count
PATCH  /api/notifications/:id/read
```

### Admin
```
GET    /api/admin/users
GET    /api/admin/restaurants
GET    /api/admin/analytics
PATCH  /api/admin/users/:id/role
```


## Kafka Event Flow

```
Order Created → Restaurant Notified → Order Confirmed → Delivery Assigned
→ Food Prepared → Order Picked Up → Out for Delivery → Order Delivered → Notification Sent
```

## Redis Usage

- **Caching**: Restaurant details, menus, popular restaurants
- **Rate Limiting**: 100 requests/minute per IP
- **Session**: Refresh token storage
- **Cart**: User shopping cart data


## Project Structure

```
foodflow/
├── docker-compose.yml
├── database/init.sql
├── shared/                  
│   ├── constants.js
│   ├── database.js
│   ├── redis.js
│   ├── kafka.js
│   └── middleware/
├── services/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── user-service/
│   ├── restaurant-service/
│   ├── order-service/
│   ├── delivery-service/
│   └── notification-service/
├── scripts/seed.js
└── tests/
```
