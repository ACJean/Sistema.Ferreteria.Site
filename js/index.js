const roleComponents = {
    Admin : renderizarVentas,
    User : renderizarLogin
}

$(async function () {

    let token = window.localStorage.getItem("token-site")
    if (token) {
        let tokenData = decodeJWT(token)
        roleComponents[tokenData.role]()
    }
    else 
    {
        await renderizarLogin()
    }
});

async function renderizarLogin() {
    await renderizar("login.html")
    $('#Autenticacion').on('submit', autenticar)
}

async function renderizarVentas() {
    await renderizar("sales.html")
}

async function renderizar(component) {
    let mainElement = $('#Main')
    let login = await fetch(component, { method : "GET" })
    mainElement.empty().append($(await login.text()))
}

async function autenticar(event) {
    event.preventDefault()
    const formData = new FormData(event.target)

    let response = await fetch(AUTENTICAR, {
        method : "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(
            { 
                usuario: formData.get('usuario'), 
                clave: formData.get('clave')
            })
    })
    let responseToken = await response.json();
    if (response.status === 401) {
        alert(responseToken.mensaje)
        return;
    }
    window.localStorage.setItem('token-site', responseToken.token)
    let tokenData = decodeJWT(responseToken.token)
    roleComponents[tokenData.role]()
}

function decodeJWT(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}