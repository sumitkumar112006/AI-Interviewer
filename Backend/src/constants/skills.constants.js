/**
 * Canonical dictionary of major skills and tech stacks.
 * Used to normalize varied raw text (e.g., "node.js", "nodejs", "node") into clean major tech stacks.
 */

const MAJOR_SKILLS_DICTIONARY = [
    // --- Languages ---
    { name: 'JavaScript', category: 'Languages', aliases: ['javascript', 'js', 'ecmascript'] },
    { name: 'TypeScript', category: 'Languages', aliases: ['typescript', 'ts'] },
    { name: 'Python', category: 'Languages', aliases: ['python', 'py', 'python3'] },
    { name: 'Java', category: 'Languages', aliases: ['java', 'jdk'] },
    { name: 'C++', category: 'Languages', aliases: ['c++', 'cpp'] },
    { name: 'C#', category: 'Languages', aliases: ['c#', 'csharp', '.net'] },
    { name: 'Go (Golang)', category: 'Languages', aliases: ['go', 'golang'] },
    { name: 'Rust', category: 'Languages', aliases: ['rust'] },
    { name: 'PHP', category: 'Languages', aliases: ['php'] },
    { name: 'SQL', category: 'Languages', aliases: ['sql', 't-sql', 'pl/sql'] },

    // --- Web & Mobile Frameworks ---
    { name: 'Node.js', category: 'Frameworks', aliases: ['node.js', 'nodejs', 'node'] },
    { name: 'React', category: 'Frameworks', aliases: ['react', 'react.js', 'reactjs', 'react native'] },
    { name: 'Express.js', category: 'Frameworks', aliases: ['express.js', 'expressjs', 'express'] },
    { name: 'Next.js', category: 'Frameworks', aliases: ['next.js', 'nextjs', 'next'] },
    { name: 'Vue.js', category: 'Frameworks', aliases: ['vue.js', 'vuejs', 'vue'] },
    { name: 'Angular', category: 'Frameworks', aliases: ['angular', 'angularjs', 'ng'] },
    { name: 'Django', category: 'Frameworks', aliases: ['django'] },
    { name: 'Flask', category: 'Frameworks', aliases: ['flask'] },
    { name: 'Spring Boot', category: 'Frameworks', aliases: ['spring boot', 'springboot', 'spring'] },
    { name: 'Tailwind CSS', category: 'Frameworks', aliases: ['tailwind', 'tailwindcss'] },
    { name: 'HTML/CSS', category: 'Frameworks', aliases: ['html', 'css', 'html5', 'css3', 'scss', 'sass'] },

    // --- Databases ---
    { name: 'MongoDB', category: 'Databases', aliases: ['mongodb', 'mongo', 'mongoose'] },
    { name: 'PostgreSQL', category: 'Databases', aliases: ['postgresql', 'postgres', 'psql'] },
    { name: 'MySQL', category: 'Databases', aliases: ['mysql'] },
    { name: 'Redis', category: 'Databases', aliases: ['redis'] },
    { name: 'Firebase', category: 'Databases', aliases: ['firebase', 'firestore'] },
    { name: 'SQL Server', category: 'Databases', aliases: ['sql server', 'mssql'] },

    // --- DevOps & Cloud ---
    { name: 'Docker', category: 'DevOps & Cloud', aliases: ['docker', 'containerization'] },
    { name: 'Kubernetes', category: 'DevOps & Cloud', aliases: ['kubernetes', 'k8s'] },
    { name: 'AWS', category: 'DevOps & Cloud', aliases: ['aws', 'amazon web services', 's3', 'ec2', 'lambda'] },
    { name: 'GCP', category: 'DevOps & Cloud', aliases: ['gcp', 'google cloud'] },
    { name: 'Azure', category: 'DevOps & Cloud', aliases: ['azure', 'microsoft azure'] },
    { name: 'Git & GitHub', category: 'DevOps & Cloud', aliases: ['git', 'github', 'gitlab', 'version control'] },
    { name: 'CI/CD', category: 'DevOps & Cloud', aliases: ['ci/cd', 'github actions', 'jenkins'] },
    { name: 'Linux', category: 'DevOps & Cloud', aliases: ['linux', 'bash', 'shell'] },

    // --- Core Architecture & Concepts ---
    { name: 'System Design', category: 'Core & Architecture', aliases: ['system design', 'architecture', 'scalability', 'distributed systems'] },
    { name: 'Data Structures', category: 'Core & Architecture', aliases: ['data structures', 'dsa', 'algorithms', 'problem solving'] },
    { name: 'REST APIs', category: 'Core & Architecture', aliases: ['rest', 'rest api', 'restful', 'apis'] },
    { name: 'GraphQL', category: 'Core & Architecture', aliases: ['graphql'] },
    { name: 'Microservices', category: 'Core & Architecture', aliases: ['microservices', 'event-driven'] },
    { name: 'Testing & QA', category: 'Core & Architecture', aliases: ['jest', 'cypress', 'unit testing', 'testing', 'qa'] }
];

/**
 * Clean AI prompt template for skill knowledge percentage evaluation
 */
const SKILL_EXTRACTION_PROMPT = `
You are an expert technical resume parser and candidate knowledge evaluation engine.
Analyze the candidate's listed experience, project depth, role complexity, and technical responses.

Rules:
1. Identify all major technical skills, languages, frameworks, databases, cloud platforms, and core concepts (e.g. Node.js, React, Python, JavaScript, Java, SQL, MongoDB, Docker, AWS, System Design).
2. For EACH detected major skill, calculate an estimated actual KNOWLEDGE PERCENTAGE (0-100%) based on:
   - Practical project experience (depth, features built, complexity)
   - Duration/level of hands-on usage described
   - Performance in technical questions and identified skill gaps
3. Return each skill with fields:
   - "name": Standardized major skill name (e.g. "Node.js", "React", "Python")
   - "category": "Languages" | "Frameworks" | "Databases" | "DevOps & Cloud" | "Core & Architecture"
   - "knowledgePercentage": Integer from 0 to 100 representing evaluated proficiency.
`;

module.exports = {
    MAJOR_SKILLS_DICTIONARY,
    SKILL_EXTRACTION_PROMPT
};
