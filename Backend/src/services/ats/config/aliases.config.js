/**
 * @file aliases.config.js
 * @module services/ats/config/aliases.config
 *
 * Canonical Skill Aliases & Collision Blocklists.
 * Normalizes technically identical technologies while preventing category-level false equivalence.
 */

'use strict';

const CANONICAL_ALIASES = {
    // Frontend
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

    // Backend & Languages
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

    // Databases
    'postgres': 'postgresql',
    'postgresql': 'postgresql',
    'psql': 'postgresql',
    'mongo': 'mongodb',
    'mongodb': 'mongodb',
    'redis': 'redis',
    'mysql': 'mysql',
    'mssql': 'sqlserver',
    'sqlite': 'sqlite',
    'dynamodb': 'dynamodb',
    'cassandra': 'cassandra',

    // Cloud & DevOps
    'aws': 'aws',
    'amazon web services': 'aws',
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

    // AI / ML
    'llm': 'llm',
    'large language models': 'llm',
    'rag': 'rag',
    'retrieval augmented generation': 'rag',
    'nlp': 'nlp',
    'pytorch': 'pytorch',
    'tensorflow': 'tensorflow',
    'keras': 'keras',
    'langchain': 'langchain',
    'llamaindex': 'llamaindex'
};

// Strict collision blocklist: forbids marking these as equivalent
const COLLISION_BLOCKS = {
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
    'csharp': ['c', 'cpp', 'java']
};

const TECH_CATALOG = {
    PROGRAMMING_LANGUAGE: [
        'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'golang', 'go',
        'ruby', 'php', 'rust', 'swift', 'kotlin', 'scala', 'c', 'dart', 'shell', 'bash'
    ],
    FRAMEWORK: [
        'react', 'reactjs', 'vue', 'vuejs', 'angular', 'nextjs', 'next.js', 'nuxtjs',
        'express', 'expressjs', 'fastapi', 'django', 'flask', 'springboot', 'spring boot',
        'nest.js', 'nestjs', 'rails', 'laravel', 'asp.net', 'flutter', 'react native'
    ],
    DATABASE: [
        'postgresql', 'postgres', 'mongodb', 'mongo', 'mysql', 'redis', 'elasticsearch',
        'sqlite', 'cassandra', 'dynamodb', 'mariadb', 'oracle', 'sql server', 'mssql', 'prisma'
    ],
    CLOUD: [
        'aws', 'azure', 'gcp', 'google cloud', 'amazon web services', 'serverless', 'lambda', 's3', 'ec2'
    ],
    DEVOPS: [
        'docker', 'kubernetes', 'k8s', 'terraform', 'ci/cd', 'cicd', 'github actions',
        'jenkins', 'ansible', 'helm', 'grafana', 'prometheus', 'nginx'
    ],
    AI_ML: [
        'llm', 'rag', 'langchain', 'llamaindex', 'pytorch', 'tensorflow', 'keras',
        'nlp', 'computer vision', 'opencv', 'scikit-learn', 'pandas', 'numpy', 'prompt engineering'
    ]
};

module.exports = {
    CANONICAL_ALIASES,
    COLLISION_BLOCKS,
    TECH_CATALOG
};
