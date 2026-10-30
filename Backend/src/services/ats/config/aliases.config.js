/**
 * @file aliases.config.js
 * @module services/ats/config/aliases.config
 *
 * Universal Canonical Skill Aliases, Catalogs & Collision Blocklists across diverse job profiles:
 * - Software & Mobile Engineering
 * - Data Science, AI/ML & Big Data
 * - Data & Business Analytics
 * - Product & Project Management
 * - UI/UX & Digital Product Design
 * - Digital Marketing & Growth
 * - Sales, Business Development & CRM
 * - Human Resources & Talent Acquisition
 * - Finance, Accounting & Operations
 */

'use strict';

const CANONICAL_ALIASES = {
    // ── Software: Frontend ──
    'react': 'reactjs',
    'react.js': 'reactjs',
    'reactjs': 'reactjs',
    'vue': 'vuejs',
    'vue.js': 'vuejs',
    'vuejs': 'vuejs',
    'angular': 'angular',
    'angular.js': 'angularjs',
    'angularjs': 'angularjs',
    'next': 'nextjs',
    'next.js': 'nextjs',
    'nextjs': 'nextjs',
    'nuxt': 'nuxtjs',
    'nuxt.js': 'nuxtjs',
    'nuxtjs': 'nuxtjs',
    'js': 'javascript',
    'javascript': 'javascript',
    'ts': 'typescript',
    'typescript': 'typescript',
    'tailwind': 'tailwindcss',
    'tailwind.css': 'tailwindcss',
    'tailwindcss': 'tailwindcss',
    'html5': 'html',
    'css3': 'css',

    // ── Software: Backend & Languages ──
    'node': 'nodejs',
    'node.js': 'nodejs',
    'nodejs': 'nodejs',
    'express': 'expressjs',
    'express.js': 'expressjs',
    'expressjs': 'expressjs',
    'python': 'python',
    'python3': 'python',
    'golang': 'go',
    'go': 'go',
    'c++': 'cpp',
    'cpp': 'cpp',
    'c#': 'csharp',
    'csharp': 'csharp',
    '.net': 'dotnet',
    'dotnet': 'dotnet',
    'fastapi': 'fastapi',
    'django': 'django',
    'flask': 'flask',
    'spring': 'springboot',
    'spring boot': 'springboot',
    'springboot': 'springboot',

    // ── Databases ──
    'postgres': 'postgresql',
    'postgresql': 'postgresql',
    'psql': 'postgresql',
    'mongo': 'mongodb',
    'mongodb': 'mongodb',
    'redis': 'redis',
    'mysql': 'mysql',
    'mssql': 'sqlserver',
    'sql server': 'sqlserver',
    'sqlite': 'sqlite',
    'dynamodb': 'dynamodb',
    'cassandra': 'cassandra',

    // ── Cloud & DevOps ──
    'aws': 'aws',
    'amazon web services': 'aws',
    'aws lambda': 'lambda',
    'gcp': 'gcp',
    'google cloud': 'gcp',
    'google cloud platform': 'gcp',
    'azure': 'azure',
    'microsoft azure': 'azure',
    'k8s': 'kubernetes',
    'kubernetes': 'kubernetes',
    'docker': 'docker',
    'terraform': 'terraform',
    'ansible': 'ansible',
    'ci/cd': 'cicd',
    'cicd': 'cicd',
    'github actions': 'githubactions',

    // ── AI / ML ──
    'llm': 'llm',
    'large language models': 'llm',
    'rag': 'rag',
    'retrieval augmented generation': 'rag',
    'nlp': 'nlp',
    'natural language processing': 'nlp',
    'pytorch': 'pytorch',
    'tensorflow': 'tensorflow',
    'keras': 'keras',
    'langchain': 'langchain',
    'llamaindex': 'llamaindex',

    // ── Data & Business Analytics ──
    'powerbi': 'power bi',
    'power bi': 'power bi',
    'tableau': 'tableau',
    'looker studio': 'google looker studio',
    'google looker studio': 'google looker studio',
    'ab testing': 'a/b testing',
    'a/b testing': 'a/b testing',
    'bi': 'business intelligence',
    'business intelligence': 'business intelligence',
    'data warehousing': 'data warehouse',
    'dwh': 'data warehouse',
    'ms excel': 'excel',
    'microsoft excel': 'excel',
    'advanced excel': 'excel',

    // ── Product & Project Management ──
    'product management': 'product management',
    'pm': 'product management',
    'scrum master': 'scrum',
    'scrum': 'scrum',
    'agile methodology': 'agile',
    'agile': 'agile',
    'kanban': 'kanban',
    'jira software': 'jira',
    'jira': 'jira',
    'product backlog': 'backlog management',
    'backlog management': 'backlog management',
    'okr': 'okrs',
    'okrs': 'okrs',
    'prd': 'prds',
    'prds': 'prds',
    'user stories': 'user stories',

    // ── UI / UX Design ──
    'figma': 'figma',
    'sketch': 'sketch',
    'adobe xd': 'adobexd',
    'ui': 'user interface',
    'ux': 'user experience',
    'ui/ux': 'ui/ux design',
    'ui/ux design': 'ui/ux design',
    'design system': 'design systems',
    'design systems': 'design systems',
    'wireframe': 'wireframing',
    'wireframing': 'wireframing',
    'prototype': 'prototyping',
    'prototyping': 'prototyping',

    // ── Digital Marketing & Growth ──
    'search engine optimization': 'seo',
    'seo': 'seo',
    'search engine marketing': 'sem',
    'sem': 'sem',
    'google analytics 4': 'ga4',
    'google analytics': 'ga4',
    'ga4': 'ga4',
    'cro': 'conversion rate optimization',
    'conversion rate optimization': 'conversion rate optimization',
    'ppc': 'pay per click',
    'pay-per-click': 'pay per click',
    'social media marketing': 'smm',
    'content strategy': 'content marketing',

    // ── Sales, HR & Operations ──
    'crm': 'crm',
    'salesforce crm': 'salesforce',
    'salesforce': 'salesforce',
    'hubspot crm': 'hubspot',
    'hubspot': 'hubspot',
    'talent acquisition': 'recruitment',
    'recruiting': 'recruitment',
    'hris': 'hris',
    'payroll management': 'payroll',
    'erp': 'erp',
    'sap erp': 'sap',
    'sap': 'sap',
    'financial modeling': 'financial modeling'
};

// Strict collision blocklist: forbids marking distinct skills as equivalent
const COLLISION_BLOCKS = {
    // Tech
    'java': ['javascript', 'typescript'],
    'javascript': ['java'],
    'typescript': ['java'],
    'aws': ['azure', 'gcp'],
    'azure': ['aws', 'gcp'],
    'gcp': ['aws', 'azure'],
    'docker': ['kubernetes'],
    'kubernetes': ['docker'],
    'python': ['django', 'flask', 'fastapi'],
    'reactjs': ['angular', 'vuejs'],
    'angular': ['reactjs', 'vuejs'],
    'vuejs': ['reactjs', 'angular'],
    'c': ['cpp', 'csharp'],
    'cpp': ['c', 'csharp'],
    'csharp': ['c', 'cpp', 'java'],

    // Analytics & BI
    'tableau': ['power bi', 'looker'],
    'power bi': ['tableau', 'looker'],

    // Design
    'figma': ['sketch', 'photoshop', 'illustrator'],

    // Management & Marketing
    'jira': ['trello', 'asana', 'clickup'],
    'seo': ['sem'], // Organic search != Paid search
    'b2b': ['b2c']
};

const TECH_CATALOG = {
    // 💻 Software Engineering
    PROGRAMMING_LANGUAGE: [
        'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'golang', 'go',
        'ruby', 'php', 'rust', 'swift', 'kotlin', 'scala', 'c', 'dart', 'shell', 'bash', 'r'
    ],
    FRAMEWORK: [
        'react', 'reactjs', 'vue', 'vuejs', 'angular', 'nextjs', 'next.js', 'nuxtjs',
        'express', 'expressjs', 'fastapi', 'django', 'flask', 'springboot', 'spring boot',
        'nest.js', 'nestjs', 'rails', 'laravel', 'asp.net', 'flutter', 'react native'
    ],
    DATABASE: [
        'postgresql', 'postgres', 'mongodb', 'mongo', 'mysql', 'redis', 'elasticsearch',
        'sqlite', 'cassandra', 'dynamodb', 'mariadb', 'oracle', 'sql server', 'mssql', 'prisma', 'neo4j'
    ],
    CLOUD: [
        'aws', 'azure', 'gcp', 'google cloud', 'amazon web services', 'serverless', 'lambda', 's3', 'ec2', 'cloud architecture'
    ],
    DEVOPS: [
        'docker', 'kubernetes', 'k8s', 'terraform', 'ci/cd', 'cicd', 'github actions',
        'jenkins', 'ansible', 'helm', 'grafana', 'prometheus', 'nginx', 'linux'
    ],
    AI_ML: [
        'llm', 'rag', 'langchain', 'llamaindex', 'pytorch', 'tensorflow', 'keras',
        'nlp', 'computer vision', 'opencv', 'scikit-learn', 'pandas', 'numpy', 'prompt engineering', 'deep learning'
    ],

    // 📊 Data & Business Analytics
    DATA_ANALYTICS: [
        'tableau', 'power bi', 'looker', 'google looker studio', 'excel', 'advanced excel',
        'vba', 'dbt', 'snowflake', 'bigquery', 'data modeling', 'etl', 'statistical analysis',
        'a/b testing', 'business intelligence', 'data visualization', 'sql', 'alteryx'
    ],

    // 🎯 Product & Project Management
    PRODUCT_MANAGEMENT: [
        'product management', 'product strategy', 'jira', 'confluence', 'agile', 'scrum',
        'kanban', 'roadmapping', 'prds', 'user stories', 'okrs', 'kpi tracking',
        'market research', 'product analytics', 'mixpanel', 'amplitude', 'stakeholder management'
    ],

    // 🎨 UI / UX & Product Design
    DESIGN: [
        'figma', 'sketch', 'adobe xd', 'photoshop', 'illustrator', 'wireframing',
        'prototyping', 'user research', 'usability testing', 'design systems',
        'information architecture', 'interaction design', 'visual design'
    ],

    // 📈 Digital Marketing & Growth
    MARKETING: [
        'seo', 'sem', 'google ads', 'google analytics', 'ga4', 'hubspot',
        'content strategy', 'email marketing', 'copywriting', 'conversion rate optimization',
        'social media marketing', 'growth hacking', 'performance marketing'
    ],

    // 💼 Sales, CRM & Business Development
    SALES_CRM: [
        'salesforce', 'hubspot crm', 'lead generation', 'cold outreach', 'account management',
        'b2b sales', 'pipeline management', 'client relationship', 'negotiation', 'crm'
    ],

    // 👥 Human Resources & Talent Acquisition
    HUMAN_RESOURCES: [
        'talent acquisition', 'recruitment', 'hris', 'employee onboarding', 'performance management',
        'payroll', 'labor law compliance', 'workday', 'greenhouse', 'lever'
    ],

    // 💰 Finance, Accounting & Operations
    FINANCE_OPERATIONS: [
        'financial modeling', 'budgeting', 'forecasting', 'sap', 'quickbooks', 'erp',
        'financial reporting', 'variance analysis', 'risk management', 'audit', 'cash flow analysis'
    ]
};

module.exports = {
    CANONICAL_ALIASES,
    COLLISION_BLOCKS,
    TECH_CATALOG
};
