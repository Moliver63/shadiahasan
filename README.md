# Shadia VR Platform 🥽

Plataforma completa de cursos online com suporte a **realidade virtual Meta Quest**, desenvolvida com tecnologias modernas para proporcionar experiências educacionais imersivas.

---

## 🎯 Funcionalidades Principais

### Para Alunos
- 📚 **Catálogo de Cursos**: Navegue por cursos disponíveis com descrições detalhadas
- 🎓 **Sistema de Matrícula**: Matricule-se facilmente em cursos de seu interesse
- 🎥 **Player de Vídeo Profissional**: Assista aulas com player adaptativo e controles completos
- 🥽 **Experiência VR**: Visualize conteúdo em 360° com suporte nativo para Meta Quest
- 📊 **Acompanhamento de Progresso**: Monitore seu avanço em cada curso
- 🔐 **Autenticação Segura**: Login via OAuth (Manus)

### Para Administradores
- 🎛️ **Painel Administrativo**: Interface completa para gerenciamento
- ➕ **CRUD de Cursos**: Crie, edite e exclua cursos
- 📝 **Gerenciamento de Aulas**: Adicione e organize aulas dentro dos cursos
- 🎬 **Upload de Vídeos**: Configure URLs de streaming (Cloudflare Stream, Mux, etc)
- 📈 **Estatísticas**: Visualize métricas de cursos, aulas e matrículas
- 👥 **Controle de Acesso**: Sistema de roles (admin/user)

---

## 🛠️ Stack Tecnológica

### Frontend
- **React 19** - Interface moderna e reativa
- **Tailwind CSS 4** - Estilização utilitária
- **shadcn/ui** - Componentes UI de alta qualidade
- **Wouter** - Roteamento leve
- **Three.js + React Three Fiber** - Renderização 3D para VR
- **@react-three/drei** - Helpers para Three.js
- **HLS.js** - Streaming de vídeo adaptativo

### Backend
- **Express 4** - Servidor Node.js
- **tRPC 11** - API type-safe end-to-end
- **Drizzle ORM** - ORM TypeScript-first
- **MySQL/TiDB** - Banco de dados relacional

### Infraestrutura
- **Manus OAuth** - Autenticação segura
- **WebXR** - API de realidade virtual
- **Vitest** - Testes unitários

---

## 📋 Estrutura do Banco de Dados

### Tabelas Principais

#### `users`
- Gerenciamento de usuários e autenticação
- Campos: id, openId, name, email, role, createdAt, updatedAt, lastSignedIn

#### `courses`
- Informações dos cursos
- Campos: id, title, slug, description, thumbnail, isPublished, createdAt, updatedAt

#### `lessons`
- Aulas vinculadas a cursos
- Campos: id, courseId, title, order, description, videoProvider, videoAssetId, videoPlaybackUrl, duration, isPublished, createdAt, updatedAt

#### `enrollments`
- Matrículas de alunos em cursos
- Campos: id, userId, courseId, progress, completedLessons, enrolledAt

---

## 🚀 Como Usar

### Acesso Administrativo

1. **Acessar Painel Admin**
   - URL: `/admin`
   - Requer role de `admin`

2. **Criar um Curso**
   - Navegue para `/admin/courses`
   - Clique em "Novo Curso"
   - Preencha: título, slug, descrição, thumbnail (opcional)
   - Marque "Publicar curso" para torná-lo visível

3. **Adicionar Aulas**
   - Na lista de cursos, clique em "Aulas"
   - Clique em "Nova Aula"
   - Configure: título, ordem, descrição, URL do vídeo
   - **URL do Vídeo**: Use URLs de streaming HLS (.m3u8) de serviços como:
     - Cloudflare Stream: `https://customer-xxxxx.cloudflarestream.com/xxxxx/manifest/video.m3u8`
     - Mux: `https://stream.mux.com/xxxxx.m3u8`
   - Marque "Publicar aula" quando pronta

### Acesso do Aluno

1. **Explorar Cursos**
   - URL: `/courses`
   - Visualize catálogo completo

2. **Matricular-se**
   - Clique em um curso
   - Clique em "Matricular-se Agora"
   - Login será solicitado se necessário

3. **Assistir Aulas**
   - Acesse "Meus Cursos" (`/my-courses`)
   - Clique em "Continuar Aprendendo"
   - Selecione uma aula da lista
   - Use o player padrão ou clique em "Ver em Modo VR 360°"

### Experiência VR com Meta Quest

1. **Preparação**
   - Acesse a plataforma pelo **Meta Quest Browser**
   - Faça login na sua conta

2. **Modo VR**
   - Ao assistir uma aula, clique em "Ver em Modo VR 360°"
   - Clique em "Modo VR" para entrar em fullscreen
   - Use os controles do Quest para navegar:
     - **Olhar ao redor**: Mova a cabeça naturalmente
     - **Zoom**: Use os controles do Quest
     - **Navegação**: Arraste com os controles

3. **Dicas para Melhor Experiência**
   - Certifique-se de estar em um ambiente bem iluminado
   - Ajuste a posição do headset para conforto
   - Use fones de ouvido para áudio imersivo

---

## 🔐 Sistema de Permissões

### Roles Disponíveis

- **admin**: Acesso completo ao painel administrativo
- **user**: Acesso a cursos e funcionalidades de aluno

### Promover Usuário a Admin

1. Acesse o banco de dados via Management UI → Database
2. Localize o usuário na tabela `users`
3. Altere o campo `role` de `user` para `admin`
4. O usuário terá acesso administrativo no próximo login

---

## 📹 Configuração de Vídeos

### Provedores Suportados

A plataforma suporta qualquer provedor de streaming que forneça URLs HLS (.m3u8):

#### Cloudflare Stream (Recomendado)
1. Faça upload do vídeo no Cloudflare Stream
2. Obtenha a URL do manifest: `https://customer-xxxxx.cloudflarestream.com/xxxxx/manifest/video.m3u8`
3. Cole a URL no campo "URL do Vídeo" ao criar/editar aula

#### Mux
1. Faça upload no Mux
2. Obtenha o Playback ID
3. URL: `https://stream.mux.com/{PLAYBACK_ID}.m3u8`

#### Outros Provedores
- Qualquer URL HLS válida funcionará
- O player detecta automaticamente e usa HLS.js quando necessário
- Safari tem suporte nativo a HLS

---

## 🧪 Testes

O projeto inclui testes unitários para garantir qualidade:

```bash
# Executar todos os testes
pnpm test

# Testes incluídos:
# - Autenticação e logout
# - CRUD de cursos (admin)
# - Controle de acesso por roles
# - Sistema de matrículas
```

---

## 📱 Responsividade

A plataforma é totalmente responsiva e funciona em:
- 🖥️ **Desktop**: Experiência completa
- 📱 **Mobile**: Interface adaptada para toque
- 📲 **Tablet**: Layout otimizado
- 🥽 **VR Headsets**: Suporte nativo Meta Quest

---

## 🎨 Personalização

### Cores e Tema

As cores podem ser personalizadas em `client/src/index.css`:
- Tema padrão: Light
- Paleta de cores: Primary (azul) + Purple (gradientes)
- Suporte a dark mode (configurável)

### Logo e Branding

- Logo: Configurável via Management UI → Settings → General
- Nome da plataforma: "Shadia VR" (personalizável)

---

## 🔄 Fluxo de Dados

### Matrícula em Curso
1. Aluno clica em "Matricular-se"
2. Sistema verifica autenticação
3. Cria registro em `enrollments`
4. Aluno ganha acesso às aulas

### Progresso de Aula
1. Player monitora tempo assistido
2. Ao atingir 90% do vídeo, marca como concluída
3. Atualiza `progress` e `completedLessons` em `enrollments`
4. Dashboard reflete progresso atualizado

---

## 🚨 Troubleshooting

### Vídeo não carrega
- Verifique se a URL HLS está correta
- Teste a URL diretamente no navegador
- Certifique-se que o vídeo está publicado no provedor

### VR não funciona
- Use **Meta Quest Browser** (não Chrome/Firefox no Quest)
- Verifique se WebXR está habilitado
- Em dispositivos sem VR, o modo fullscreen é usado como fallback

### Erro de permissão
- Verifique o role do usuário no banco de dados
- Admins têm acesso a `/admin/*`
- Users têm acesso a `/courses`, `/my-courses`, `/lesson/*`

---

## 📚 Recursos Adicionais

### Documentação de Referência
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [WebXR Device API](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API)
- [HLS.js](https://github.com/video-dev/hls.js/)
- [tRPC](https://trpc.io/)

### Próximos Passos Sugeridos
- [ ] Adicionar sistema de certificados
- [ ] Implementar chat ao vivo durante aulas
- [ ] Criar fórum de discussão por curso
- [ ] Adicionar suporte a legendas/closed captions
- [ ] Integrar sistema de pagamento (Stripe)

---

## 📄 Licença

MIT License - Sinta-se livre para usar e modificar.

---

## 🤝 Suporte

Para dúvidas ou problemas:
1. Verifique esta documentação
2. Consulte os logs do servidor
3. Acesse o Management UI para diagnósticos

---

**Desenvolvido com ❤️ para revolucionar a educação online através da realidade virtual.**
