// Obsidian Vault Integration
// Pour synchroniser les notes et le workflow d'agents

const fs = require('fs');
const path = require('path');

const DEFAULT_VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || '/opt/data/agent-studio/vault';

/**
 * Crée la structure de base du vault Obsidian
 */
function initializeVault(vaultPath = DEFAULT_VAULT_PATH) {
  const structure = [
    '00-Inbox',
    '01-Projects',
    '02-Archive',
    'Templates',
    'Tags'
  ];
  
  structure.forEach(dir => {
    const dirPath = path.join(vaultPath, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
  
  // Créer README du vault
  const readmePath = path.join(vaultPath, 'README.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, `# Agent Studio Vault\n\n## Structure\n- 00-Inbox: Notes en attente\n- 01-Projects: Projets actifs\n- 02-Archive: Notes archivées\n- Templates: Modèles\n`);
  }
  
  return vaultPath;
}

/**
 * Crée une note dans le vault
 * @param {string} vaultPath - Chemin du vault
 * @param {string} notePath - Chemin relatif de la note
 * @param {string} content - Contenu de la note
 * @param {object} frontmatter - Frontmatter YAML optionnel
 */
function createNote(vaultPath, notePath, content, frontmatter = {}) {
  const fullPath = path.join(vaultPath, notePath);
  const dir = path.dirname(fullPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  let yaml = '';
  if (Object.keys(frontmatter).length > 0) {
    yaml = '---\n';
    Object.entries(frontmatter).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        yaml += `${key}: ${value.map(v => `\`${v}\``).join(' ')}\n`;
      } else {
        yaml += `${key}: "${value}"\n`;
      }
    });
    yaml += '---\n\n';
  }
  
  fs.writeFileSync(fullPath, yaml + content);
  return fullPath;
}

/**
 * Récupère une note du vault
 * @param {string} vaultPath - Chemin du vault
 * @param {string} notePath - Chemin relatif de la note
 * @returns {object} - { content, frontmatter, path }
 */
function getNote(vaultPath, notePath) {
  const fullPath = path.join(vaultPath, notePath);
  
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Extraire le frontmatter
  const yamlMatch = content.match(/^---\n([\s\S]*?)---\n/);
  let frontmatter = {};
  let body = content;
  
  if (yamlMatch) {
    const yaml = yamlMatch[1];
    body = content.slice(yamlMatch[0].length);
    
    // Parser YAML simple
    yaml.split('\n').forEach(line => {
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (match) {
        const key = match[1];
        let value = match[2].trim();
        
        // Supprimer les guillemets
        value = value.replace(/^["']|["']$/g, '');
        
        // Gérer les tableaux
        if (value.startsWith('`') && value.endsWith('`')) {
          value = value.slice(1, -1).split('` `').map(v => v.replace(/`/g, ''));
        }
        
        frontmatter[key] = value;
      }
    });
  }
  
  return { content: body, frontmatter, path: fullPath };
}

/**
 * Recherche des notes dans le vault
 * @param {string} vaultPath - Chemin du vault
 * @param {string} query - Requête de recherche
 * @returns {array} - Liste de notes correspondantes
 */
function searchNotes(vaultPath, query) {
  const results = [];
  const queryLower = query.toLowerCase();
  
  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (file.endsWith('.md')) {
        const note = getNote(vaultPath, path.relative(vaultPath, filePath));
        
        if (note && (
          note.content.toLowerCase().includes(queryLower) ||
          JSON.stringify(note.frontmatter).toLowerCase().includes(queryLower)
        )) {
          results.push({
            ...note,
            relative_path: path.relative(vaultPath, filePath)
          });
        }
      }
    });
  }
  
  if (fs.existsSync(vaultPath)) {
    walkDir(vaultPath);
  }
  
  return results;
}

/**
 * Crée un template de note d'agent
 */
function createAgentTemplate(vaultPath, agentName) {
  const content = `# ${agentName} - Agent IA\n\n## Statut\n- Type: \n- Status: ${new Date().toISOString()}\n- Dernière activité: \n\n## Mémoire individuelle\n\n### Objectifs\n\n### Décisions\n\n### Issues\n\n## Mémoire partagée\n\n### Context global\n\n### Notifications\n`;
  
  return createNote(
    vaultPath,
    `Templates/Agent-Note.md`,
    content,
    { title: 'Agent Template', tags: ['#template', '#agent'] }
  );
}

module.exports = {
  initializeVault,
  createNote,
  getNote,
  searchNotes,
  createAgentTemplate,
  DEFAULT_VAULT_PATH
};