// INSIRA SEUS DADOS DO SUPABASE AQUI (Entre as aspas)
const SUPABASE_URL = 'COLE_AQUI_SUA_URL';
const SUPABASE_ANON_KEY = 'COLE_AQUI_SUA_CHAVE_PUBLICABLE';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const tela = document.getElementById(viewId + '-view');
    if (tela) {
        tela.classList.add('active');
    }
    if (viewId === 'search') loadPublicProfiles();
    if (viewId === 'matches') loadMatches();
    if (viewId === 'profile') loadMyProfile();
}

// OUVINTE DE AUTENTICAÇÃO (Agora detecta quando o usuário quer redefinir senha)
db.auth.onAuthStateChange((event, session) => {
    // Se o evento for RECUPERAÇÃO DE SENHA, mostra a tela de nova senha
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
        if (!activeView) {
            showView('home');
        }
    }
});

// AÇÃO: Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
        alert('Erro no login: ' + error.message);
    }
});

// AÇÃO: Solicitar Recuperação de Senha
async function forgotPassword() {
    const email = document.getElementById('login-email').value;
    if (!email) {
        return alert("Por favor, digite seu e-mail no campo acima e clique em 'Esqueci minha senha' novamente.");
    }
    
    // Pede ao Supabase para enviar o e-mail de recuperação
    const { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
    });
    
    if (error) {
        alert("Erro ao enviar e-mail: " + error.message);
    } else {
        alert("As instruções de recuperação foram enviadas para o seu e-mail!");
    }
}

// AÇÃO: Salvar a Nova Senha (tela de redefinição)
document.getElementById('reset-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    
    const { error } = await db.auth.updateUser({ password: newPassword });
    
    if (error) {
        alert("Erro ao atualizar senha: " + error.message);
    } else {
        alert("Senha atualizada com sucesso!");
        showView('search'); // Manda o usuário para a busca
    }
});

// AÇÃO: Cadastro (Agora com verificação estrita de erros)
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    // 1. Cria usuário
    const { data: authData, error: authError } = await db.auth.signUp({ email, password });
    if (authError) return alert('Erro ao criar conta: ' + authError.message);
    
    const userId = authData.user.id;

    // 2. Salva Dados Públicos
    const { error: pubError } = await db.from('public_profiles').insert({
        id: userId,
        current_org: document.getElementById('reg-curr-org').value,
        current_state: document.getElementById('reg-curr-state').value,
        desired_state: document.getElementById('reg-des-state').value,
        desired_org: document.getElementById('reg-des-org').value,
        status: document.getElementById('reg-status').value
    });

    if (pubError) {
        return alert('Falha ao salvar dados públicos. Detalhe: ' + pubError.message);
    }

    // 3. Salva Dados Privados
    const { error: privError } = await db.from('private_details').insert({
        id: userId,
        full_name: document.getElementById('reg-name').value,
        email: email,
        phone: document.getElementById('reg-phone').value
    });

    if (privError) {
        return alert('Falha ao salvar dados privados. Detalhe: ' + privError.message);
    }

    alert("Cadastro realizado! Você foi conectado com sucesso.");
    // Como tiramos a confirmação de email, o sistema loga ele automaticamente, então podemos limpar o form
    document.getElementById('register-form').reset(); 
});

// AÇÃO: Sair
async function logout() {
    await db.auth.signOut();
    showView('home');
}

// BUSCA 1: Perfis
async function loadPublicProfiles() {
    const list = document.getElementById('public-profiles-list');
    list.innerHTML = 'Buscando perfis...';

    let query = db.from('public_profiles').select('*');
    if (currentUser) query = query.neq('id', currentUser.id);

    const { data, error } = await query;
    if (error) return list.innerHTML = 'Erro de conexão com o banco.';
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

// BUSCA 2: Matches
async function loadMatches() {
    const list = document.getElementById('matches-list');
    list.innerHTML = 'Procurando matches...';

    const { data, error } = await db.from('user_matches').select('*');
    if (error) return list.innerHTML = 'Erro ao buscar matches.';
    
    if (data.length === 0) return list.innerHTML = 'Nenhum match por enquanto. O sistema avisará quando houver reciprocidade.';

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

// CONTADOR MATCH
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

// BUSCA 3: Perfil
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
