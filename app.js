// ==========================================
// 1. CONEXÃO COM O BANCO DE DADOS
// ==========================================
// ATENÇÃO: A URL precisa obrigatoriamente começar com https://
const SUPABASE_URL = 'https://wspghpjjtqvlcvlskbbp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vcmvKSxkBg8tP_VBukgE2g_-BsIJnW2';

// Trava de segurança para evitar que o site quebre se a URL estiver errada
if (!SUPABASE_URL.startsWith('http')) {
    alert("⚠️ ERRO NO CÓDIGO: A sua SUPABASE_URL está incompleta. Ela precisa começar com 'https://'. Corrija no arquivo app.js.");
}

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

// ==========================================
// 2. SISTEMA DE NAVEGAÇÃO DE TELAS
// ==========================================
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const tela = document.getElementById(viewId + '-view');
    if (tela) tela.classList.add('active');
    
    if (viewId === 'search') loadPublicProfiles();
    if (viewId === 'matches') loadMatches();
    if (viewId === 'profile') loadMyProfile();
}

// ==========================================
// 3. MONITORAMENTO DE SESSÃO E RECUPERAÇÃO DE SENHA
// ==========================================
db.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
        showView('reset-password');
        return;
    }

    if (session) {
        currentUser = session.user;
        document.body.classList.add('logged-in'); 
        const authView = document.getElementById('auth-view');
        if (authView && authView.classList.contains('active')) {
            showView('search');
        }
        checkMatchCount();
    } else {
        currentUser = null;
        document.body.classList.remove('logged-in'); 
        const activeView = document.querySelector('.view.active');
        if (!activeView) showView('home');
    }
});

// ==========================================
// 4. FUNÇÕES DOS FORMULÁRIOS (LOGIN, CADASTRO, SENHA)
// ==========================================

// LOGIN
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault(); // Impede a página de recarregar
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) alert('Erro no login: Usuário ou senha incorretos.');
});

// ESQUECI A SENHA
async function forgotPassword() {
    const email = document.getElementById('login-email').value;
    if (!email) {
        return alert("Por favor, digite seu e-mail no campo acima e clique em 'Esqueci minha senha' novamente.");
    }
    
    const { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
    });
    
    if (error) {
        alert("Erro: " + error.message);
    } else {
        alert("As instruções foram enviadas para o seu e-mail! Verifique sua caixa de entrada.");
    }
}

// NOVA SENHA
const resetForm = document.getElementById('reset-password-form');
if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const { error } = await db.auth.updateUser({ password: newPassword });
        
        if (error) {
            alert("Erro ao atualizar senha: " + error.message);
        } else {
            alert("Senha atualizada com sucesso!");
            showView('search');
        }
    });
}

// CADASTRO
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    const { data: authData, error: authError } = await db.auth.signUp({ email, password });
    if (authError) return alert('Erro ao criar conta: ' + authError.message);
    
    const userId = authData.user.id;

    const { error: pubError } = await db.from('public_profiles').insert({
        id: userId,
        current_org: document.getElementById('reg-curr-org').value,
        current_state: document.getElementById('reg-curr-state').value,
        desired_state: document.getElementById('reg-des-state').value,
        desired_org: document.getElementById('reg-des-org').value,
        status: document.getElementById('reg-status').value
    });

    if (pubError) return alert('Falha ao salvar dados públicos: ' + pubError.message);

    const { error: privError } = await db.from('private_details').insert({
        id: userId,
        full_name: document.getElementById('reg-name').value,
        email: email,
        phone: document.getElementById('reg-phone').value
    });

    if (privError) return alert('Falha ao salvar dados privados: ' + privError.message);

    alert("Cadastro realizado! Você foi conectado automaticamente.");
    document.getElementById('register-form').reset(); 
});

// SAIR
async function logout() {
    await db.auth.signOut();
    showView('home');
}

// ==========================================
// 5. FUNÇÕES DO BANCO DE DADOS (BUSCAS)
// ==========================================

async function loadPublicProfiles() {
    const list = document.getElementById('public-profiles-list');
    list.innerHTML = 'Buscando perfis...';

    let query = db.from('public_profiles').select('*');
    if (currentUser) query = query.neq('id', currentUser.id);

    const { data, error } = await query;
    if (error) return list.innerHTML = 'Erro de conexão.';
    if (data.length === 0) return list.innerHTML = 'Nenhum perfil disponível.';

    list.innerHTML = data.map(p => `
        <div class="card">
            <h3>Perfil #${p.id.substring(0, 6).toUpperCase()}</h3>
            <p><strong>De:</strong> ${p.current_org} / ${p.current_state}</p>
            <p><strong>Para:</strong> ${p.desired_org || 'Qualquer'} / ${p.desired_state}</p>
            <p><strong>Situação:</strong> ${p.status}</p>
            <span class="tag">Contatos Ocultos</span>
        </div>
    `).join('');
}

async function loadMatches() {
    const list = document.getElementById('matches-list');
    list.innerHTML = 'Procurando matches...';

    const { data, error } = await db.from('user_matches').select('*');
    if (error) return list.innerHTML = 'Erro ao buscar matches.';
    
    if (data.length === 0) return list.innerHTML = 'Nenhum match por enquanto. Avisaremos quando houver reciprocidade.';

    list.innerHTML = data.map(m => `
        <div class="card match-card">
            <div class="match-badge">✓ MATCH CONFIRMADO</div>
            <h3>${m.full_name || 'Nome Protegido'}</h3>
            <p><strong>De:</strong> ${m.current_org} / ${m.current_state}</p>
            <p><strong>Para:</strong> ${m.desired_org || 'Qualquer'} / ${m.desired_state}</p>
            <hr>
            <p>📧 Email: ${m.email}</p>
            <p>📱 WhatsApp: ${m.phone}</p>
            <span class="tag">${m.status}</span>
        </div>
    `).join('');
}

async function checkMatchCount() {
    if (!currentUser) return;
    const { data } = await db.from('user_matches').select('match_id');
    const badge = document.getElementById('match-badge');
    if (data && data.length > 0) {
        badge.textContent = `(${data.length})`;
        badge.style.color = '#ffeb3b'; 
    } else {
        badge.textContent = '';
    }
}

async function loadMyProfile() {
    const div = document.getElementById('my-profile-info');
    div.innerHTML = 'Carregando dados...';

    const { data: pub } = await db.from('public_profiles').select('*').eq('id', currentUser.id).single();
    const { data: priv } = await db.from('private_details').select('*').eq('id', currentUser.id).single();

    if (!pub || !priv) return div.innerHTML = 'Não foi possível carregar seu perfil.';

    div.innerHTML = `
        <div class="card">
            <h3>${priv.full_name}</h3>
            <p><strong>Email:</strong> ${priv.email} <br> <strong>Telefone:</strong> ${priv.phone}</p>
            <hr>
            <p><strong>Órgão Atual:</strong> ${pub.current_org} - ${pub.current_state}</p>
            <p><strong>Deseja ir para:</strong> ${pub.desired_org || 'Qualquer'} - ${pub.desired_state}</p>
            <p><strong>Situação:</strong> ${pub.status}</p>
        </div>
    `;
}

Como colar sua URL agora (Exemplo):

Na linha 4 do código, você deve colar a URL exatamente com essa estrutura, sem
tirar as aspas simples do começo e do final:

✅ CERTO: const SUPABASE_URL = 'https://wspghpjjtqvlcvlskbbp.supabase.co';

❌ ERRADO (Sem https): const SUPABASE_URL = 'wspghpjjtqvlcvlskbbp.supabase.co';

❌ ERRADO (Sem as aspas): const SUPABASE_URL =
https://wspghpjjtqvlcvlskbbp.supabase.co;

Pode fazer esse ajuste e colar no seu arquivo. Modifique lá no seu index.html a
última linha para <script src="app.js?v=5"></script> (para garantir que ele
carregue essa versão nova), salve no GitHub e teste. Estarei aqui no aguardo,
dessa vez vai funcionar 100%!
