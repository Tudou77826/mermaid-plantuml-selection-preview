# Mermaid 右键预览测试集

本文档用于验证 Mermaid 选区预览扩展。每个示例都可以采用以下任一方式测试：

1. 框选整个代码块，包括开头的 ` ```mermaid ` 和结尾的 ` ``` `。
2. 只框选代码块内部的 Mermaid 正文，不包含 Markdown 围栏。

框选后点击鼠标右键，选择“预览 Mermaid 图”。

## 1. 多阶段发布流程图

```mermaid
flowchart LR
    classDef source fill:#e8f5ed,stroke:#277d50,stroke-width:2px,color:#14251c
    classDef process fill:#fff4c7,stroke:#a27713,stroke-width:2px,color:#33280d
    classDef danger fill:#ffe4df,stroke:#ad382f,stroke-width:2px,color:#3b1713
    classDef success fill:#d8ff63,stroke:#52720b,stroke-width:2px,color:#1b2605

    subgraph DEV[开发阶段]
        A[提交代码]:::source --> B{静态检查}:::process
        B -->|通过| C[单元测试]:::process
        B -->|失败| X1[阻断提交]:::danger
        C -->|覆盖率达标| D[构建制品]:::process
        C -->|失败| X2[通知开发者]:::danger
    end

    subgraph DELIVERY[交付阶段]
        D --> E[(制品仓库)]:::source
        E --> F[部署测试环境]:::process
        F --> G{自动化验收}:::process
        G -->|通过| H[人工审批]:::process
        G -->|失败| R1[自动回滚]:::danger
    end

    subgraph PROD[生产阶段]
        H -->|批准| I[灰度 10%]:::process
        H -->|拒绝| R2[退回修改]:::danger
        I --> J{指标健康?}:::process
        J -->|是| K[全量发布]:::success
        J -->|否| R3[切回旧版本]:::danger
    end

    R1 -. 诊断报告 .-> A
    R2 -. 修改意见 .-> A
    R3 -. 事故复盘 .-> A
```

## 2. 带并行和异常分支的时序图

```mermaid
sequenceDiagram
    autonumber
    actor U as 用户
    participant W as Web 前端
    participant G as API 网关
    participant O as 订单服务
    participant P as 支付服务
    participant M as 消息队列
    participant S as 库存服务

    U->>W: 提交订单
    W->>G: POST /orders
    activate G
    G->>O: 创建待支付订单
    activate O
    O->>S: 预占库存
    alt 库存充足
        S-->>O: 预占成功
        O-->>G: orderId + paymentToken
        G-->>W: 201 Created
        W->>P: 发起支付
        activate P
        alt 支付成功
            P-->>W: 支付结果
            P->>M: 发布 PaymentSucceeded
            par 更新订单
                M->>O: PaymentSucceeded
                O->>O: 状态改为已支付
            and 扣减库存
                M->>S: PaymentSucceeded
                S->>S: 确认扣减
            end
            Note over O,S: 两个消费者独立重试并保证幂等
        else 支付失败或超时
            P-->>W: 支付失败
            P->>M: 发布 PaymentFailed
            M->>S: 释放预占库存
        end
        deactivate P
    else 库存不足
        S-->>O: 预占失败
        O-->>G: OUT_OF_STOCK
        G-->>W: 409 Conflict
        W-->>U: 商品库存不足
    end
    deactivate O
    deactivate G
```

## 3. 嵌套状态机

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Reviewing: 提交审核

    state Reviewing {
        [*] --> AutomatedCheck
        AutomatedCheck --> ManualCheck: 自动检查通过
        AutomatedCheck --> Rejected: 自动检查失败
        ManualCheck --> Approved: 审核通过
        ManualCheck --> Rejected: 审核拒绝
        Rejected --> [*]
        Approved --> [*]
    }

    Reviewing --> Draft: 退回修改
    Reviewing --> Scheduled: 审核完成
    Scheduled --> Publishing: 到达发布时间

    state Publishing {
        [*] --> Canary
        Canary --> FullRelease: 指标正常
        Canary --> Rollback: 指标异常
        FullRelease --> [*]
        Rollback --> [*]
    }

    Publishing --> Published: 全量发布
    Publishing --> Draft: 回滚
    Published --> Archived: 归档
    Archived --> [*]

    note right of Reviewing
      自动检查和人工审核
      均完成后才能发布
    end note
```

## 4. 领域模型类图

```mermaid
classDiagram
    direction LR

    class AggregateRoot {
        <<abstract>>
        +UUID id
        +long version
        +recordEvent(event)
    }

    class Order {
        -OrderStatus status
        -Money total
        -List~OrderLine~ lines
        +addProduct(product, quantity)
        +confirm()
        +cancel(reason)
    }

    class OrderLine {
        -ProductId productId
        -int quantity
        -Money unitPrice
        +subtotal() Money
    }

    class Money {
        <<value object>>
        +Decimal amount
        +Currency currency
        +add(other) Money
        +multiply(value) Money
    }

    class OrderRepository {
        <<interface>>
        +findById(id) Order
        +save(order)
    }

    class DomainEventPublisher {
        <<interface>>
        +publish(events)
    }

    AggregateRoot <|-- Order
    Order "1" *-- "1..*" OrderLine : contains
    Order --> Money : total
    OrderLine --> Money : unit price
    OrderRepository ..> Order : persists
    Order ..> DomainEventPublisher : emits events
```

## 5. 电商数据模型 ER 图

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER ||--o{ ADDRESS : owns
    ORDER ||--|{ ORDER_ITEM : contains
    ORDER ||--o| PAYMENT : paid_by
    ORDER ||--o{ ORDER_STATUS_LOG : records
    PRODUCT ||--o{ ORDER_ITEM : referenced_by
    PRODUCT }o--|| CATEGORY : belongs_to
    WAREHOUSE ||--o{ INVENTORY : stores
    PRODUCT ||--o{ INVENTORY : stocked_as

    CUSTOMER {
        uuid id PK
        string email UK
        string display_name
        datetime created_at
    }
    ORDER {
        uuid id PK
        uuid customer_id FK
        string status
        decimal total_amount
        datetime created_at
    }
    ORDER_ITEM {
        uuid order_id PK, FK
        uuid product_id PK, FK
        int quantity
        decimal unit_price
    }
    PRODUCT {
        uuid id PK
        uuid category_id FK
        string sku UK
        string name
        decimal price
    }
    PAYMENT {
        uuid id PK
        uuid order_id FK
        string provider
        string transaction_id UK
        string status
    }
    ADDRESS {
        uuid id PK
        uuid customer_id FK
        string province
        string city
        string detail
    }
    CATEGORY {
        uuid id PK
        string name
    }
    WAREHOUSE {
        uuid id PK
        string name
        string region
    }
    INVENTORY {
        uuid warehouse_id PK, FK
        uuid product_id PK, FK
        int available
        int reserved
    }
    ORDER_STATUS_LOG {
        uuid id PK
        uuid order_id FK
        string from_status
        string to_status
        datetime changed_at
    }
```

## 6. 版本发布甘特图

```mermaid
gantt
    title 2.0 版本发布计划
    dateFormat  YYYY-MM-DD
    axisFormat  %m/%d
    excludes    weekends

    section 产品与设计
    需求澄清           :done, req, 2026-07-01, 4d
    交互设计           :done, ux, after req, 5d
    设计评审           :milestone, review, after ux, 0d

    section 研发
    基础架构           :done, arch, 2026-07-03, 6d
    核心功能           :active, core, after arch, 10d
    数据迁移工具       :migration, after arch, 7d
    联调               :integration, after core, 5d

    section 质量保障
    测试方案           :testplan, 2026-07-10, 4d
    系统测试           :crit, systemtest, after integration, 6d
    性能与安全测试     :crit, security, after systemtest, 4d

    section 发布
    发布评审           :milestone, gate, after security, 0d
    灰度发布           :crit, canary, after gate, 2d
    全量发布           :milestone, release, after canary, 0d
```

## 7. 平台能力思维导图

```mermaid
mindmap
  root((内部开发平台))
    研发工作台
      项目脚手架
        前端模板
        后端模板
        基础设施模板
      在线开发环境
      代码搜索
    持续交付
      流水线
        编译
        测试
        安全扫描
      制品管理
      环境管理
        测试环境
        预发布环境
        生产环境
    可观测性
      指标
      日志
      链路追踪
      告警中心
    平台治理
      权限与审计
      成本分析
      服务目录
      技术雷达
```

## 8. 用户旅程图

```mermaid
journey
    title 新成员首次发布服务
    section 准备
      阅读接入文档: 3: 新成员
      申请项目权限: 2: 新成员, 管理员
      创建代码仓库: 5: 新成员
    section 开发
      从模板创建服务: 5: 新成员
      本地运行与调试: 4: 新成员
      提交合并请求: 4: 新成员, 审核人
    section 交付
      观察流水线: 5: 新成员
      修复质量门禁: 2: 新成员
      部署测试环境: 5: 新成员
      发起生产审批: 3: 新成员, 负责人
      完成首次发布: 5: 新成员, 负责人
```
