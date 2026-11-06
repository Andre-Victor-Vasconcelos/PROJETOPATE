// INSIRA SEUS DADOS DO SUPABASE AQUI (Entre as aspas)
const SUPABASE_URL = 'https://wspghpjjtqvlcvlskbbp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vcmvKSxkBg8tP_VBukgE2g_-BsIJnW2';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

// FUNÇÃO: Trocar de telas (Home, Login, Busca, etc)
function showView(viewId) {
    // Remove classe ativa de todas as telas
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Adiciona classe ativa na tela escolhida
    const tela = document.getElementById(viewId + '-view');
    if (tela) {
        tela.classList.add('active');
    }
    
    // Atualiza os dados da tela
    if (viewId === 'search') loadPublicProfiles();
    if (viewId === 'matches') loadMatches();
    if (viewId === 'profile') loadMyProfile();
}

// OUVINTE: Verifica sempre se o usuário está logado ou não
supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        // Logou
        currentUser = session.user;
        document.body.classList.add('logged-in'); 
        
        // Se estiver na tela de login, manda para a busca de perfis
        const authView = document.getElementById('auth-view');
        if (authView && authView.classList.contains('active')) {
            showView('search');
        }
        checkMatchCount();
    } else {
        // Deslogou / Visitante
        currentUser = null;
        document.body.classList.remove('logged-in'); 
        
        // Se estiver solto sem tela, vai pra Home
        const activeView = document.querySelector('.view.active');
        if (!activeView) {
            showView('home');
        }
    }
});

// AÇÃO: Fazer Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        alert('Erro no login. Verifique seu e-mail e senha.');
    }
});

// AÇÃO: Fazer Cadastro
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    // 1. Cria usuário no Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) return alert('Erro ao criar conta: ' + authError.message);
    
    const userId = authData.user.id;

    // 2. Salva Dados Públicos
    await supabase.from('public_profiles').insert({
        id: userId,
        current_org: document.getElementById('reg-curr-org').value,
        current_state: document.getElementById('reg-curr-state').value,
        desired_state: document.getElementById('reg-des-state').value,
        desired_org: document.getElementById('reg-des-org').value,
        status: document.getElementById('reg-status').value
    });

    // 3. Salva Dados Privados
    await supabase.from('private_details').insert({
        id: userId,
        full_name: document.getElementById('reg-name').value,
        email: email,
        phone: document.getElementById('reg-phone').value
    });

    alert("Cadastro realizado! Faça login agora na tela ao lado.");
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').focus();
});

// AÇÃO: Sair da conta
async function logout() {
    await supabase.auth.signOut();
    showView('home');
}

// BUSCA 1: Perfis Disponíveis
async function loadPublicProfiles() {
    const list = document.getElementById('public-profiles-list');
    list.innerHTML = 'Buscando perfis...';

    // Se estiver logado, não busca a si mesmo
    let query = supabase.from('public_profiles').select('*');
    if (currentUser) {
        query = query.neq('id', currentUser.id);
    }

    const { data, error } = await query;
    if (error) return list.innerHTML = 'Erro de conexão com o banco de dados.';
    if (data.length === 0) return list.innerHTML = 'Nenhum servidor cadastrado ainda.';

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

// BUSCA 2: Meus Matches
async function loadMatches() {
    const list = document.getElementById('matches-list');
    list.innerHTML = 'Procurando matches...';

    const { data, error } = await supabase.from('user_matches').select('*');
    if (error) return list.innerHTML = 'Erro ao buscar matches.';
    
    if (data.length === 0) {
        list.innerHTML = 'Nenhum match por enquanto. O sistema avisará quando houver reciprocidade.';
        return;
    }

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

// UTILIDADE: Contador do Menu de Matches
async function checkMatchCount() {
    if (!currentUser) return;
    const { data } = await supabase.from('user_matches').select('match_id');
    const badge = document.getElementById('match-badge');
    if (data && data.length > 0) {
        badge.textContent = `(${data.length})`;
        badge.style.color = '#ffeb3b'; 
    } else {
        badge.textContent = '';
    }
}

// BUSCA 3: Meu próprio Perfil
async function loadMyProfile() {
    const div = document.getElementById('my-profile-info');
    div.innerHTML = 'Carregando dados...';

    const { data: pub } = await supabase.from('public_profiles').select('*').eq('id', currentUser.id).single();
    const { data: priv } = await supabase.from('private_details').select('*').eq('id', currentUser.id).single();

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
