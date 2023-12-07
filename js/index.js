const roleComponents = {
    Admin: renderizarVentas,
    User: renderizarUsuario
}

let tableReporteVentas;

$(async function () {

    let token = window.localStorage.getItem("token-site")
    if (token) {
        let tokenData = decodeJWT(token)
        roleComponents[tokenData.role]()
    }
    else {
        await renderizarLogin()
    }
});

async function renderizarUsuario() {
    await renderizar("usuario.html")
    $('#BtnSalir').on('click', salir)
    $('#BtnArticulosCliente').on('click', moduloArticuloCliente)
    $('#BtnCompras').on('click', moduloComprasCliente)
}

async function renderizarLogin() {
    await renderizar("login.html")
    $('#Autenticacion').on('submit', autenticar)
}

async function renderizarVentas() {
    await renderizar("sales.html")
    let response = await getResourcesApi(ARTICULOS, {
        method: "GET",
        headers: {
            Authorization: getAuthorization()
        }
    })
    if (response.error) {
        await renderizarLogin()
        return
    }
    let articulos = (await response.json()).datos
    let contenedorArticulos = $('#Articulos')
    $.each(articulos, (index, articulo) => {
        let elem = `<button class="items__element" data-id="${articulo.id}" data-codigo="${articulo.codigo}">` +
            `<img src="data:image/webp;base64,${articulo.imagenes[0].imagenBase64}" alt="${articulo.nombre}" class="image" width="64" height="64">` +
            `<h5 class="text">${articulo.nombre}</h5>` +
            `</button>`
        contenedorArticulos.append(elem)
    })

    $('.items__element').on('click', agregarItem)

    let cuenta = getCheck()
    if (!cuenta) cuenta = iniciarCuenta()
    renderizarDetallesCuenta(cuenta)

    //Modulo Clientes
    $('#Cliente').on('click', moduloCliente)

    //Modulo Admin
    $('#Funciones').on('click', moduloFunciones)

    //Pago
    $('#Pagar').on('click', procesarPago)

    $('#CancelarCuenta').on('click', cancelarCuenta)
}

async function agregarItem(e) {
    let codigo = $(this).data('codigo')
    let response = await getResourcesApi(`${ARTICULOS}/${codigo}`, {
        method: "GET",
        headers: {
            Authorization: getAuthorization()
        }
    })
    if (response.error) {
        await renderizarLogin()
        return
    }
    let articulo = (await response.json()).datos
    if (articulo.stock <= 0) {
        alert('Ya no hay stock de este producto.')
        return
    }
    let cuenta = obtenerCuenta()
    let detalle = obtenerDetalle(cuenta, articulo.id)
    if (!detalle) {
        detalle = {
            tipo: 0,
            articuloId: articulo.id,
            articuloNombre: articulo.nombre,
            cantidad: 1,
            total: 0
        }
        cuenta.detalles.push(detalle)
    } else detalle.cantidad += 1;
    detalle.total = articulo.precio * detalle.cantidad

    renderizarDetallesCuenta(cuenta)
    setCheck(cuenta)
}

function renderizarDetallesCuenta(cuenta) {
    cuenta.subtotal = cuenta.detalles.reduce((acumulador, current) => {
        return acumulador + current.total
    }, 0)
    cuenta.impuestos = +(cuenta.subtotal * cuenta.porcentajeImpuesto).toFixed(2)
    cuenta.total = cuenta.subtotal + cuenta.impuestos

    let elementoDetallesCuenta = $('#DetallesCuenta')
    elementoDetallesCuenta.empty()
    $.each(cuenta.detalles, (index, detalle) => {
        let elementoDetalle = $(`<div class="detail__item">
                                    <i class="fa-solid fa-angle-right"></i>
                                    <p class="text text--center">${detalle.cantidad}</p>
                                    <p class="text">${detalle.articuloNombre}</p>
                                    <p class="text">${detalle.total}</p>
                                    <button class="btn btn--remove btn--32 btn--circle remove-detail" data-id="${detalle.articuloId}"><i class="fa-solid fa-circle-minus"></i></button>
                                </div>`)
        elementoDetallesCuenta.append(elementoDetalle)
    })
    $('.remove-detail').on('click', function (e) {
        let articuloId = $(this).data('id')
        eliminarDetalle(articuloId)
    })
    $('#Subtotal').text(cuenta.subtotal.toFixed(2))
    $('#Impuestos').text(cuenta.impuestos.toFixed(2))
    $('#Total').text(cuenta.total.toFixed(2))

    renderizarDatosCliente(cuenta)
}

async function renderizar(url) {
    let mainElement = $('#Main')
    let component = await getResources(url, { method: "GET" })
    mainElement.empty().append($(await component.text()))
}

async function autenticar(event) {
    event.preventDefault()
    const formData = new FormData(event.target)

    let response = await getResourcesApi(AUTENTICAR, {
        method: "POST",
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
    console.log(responseToken)
    if (response.status === 401) {
        alert(responseToken.mensaje)
        return;
    }
    window.localStorage.setItem('token-site', responseToken.token)
    let tokenData = decodeJWT(responseToken.token)
    roleComponents[tokenData.role]()
}

async function moduloCliente(e) {
    let elementBody = $('body')
    let elementWindow = elementBody.find('.window')
    if (elementWindow.length !== 0) return;
    let component = await getResources('cliente.html', { method: "GET" })
    elementBody.append($(await component.text()))
    addEventCloseWindow(elementBody)
    $('#BuscarCliente').on('click', buscarCliente)
    $('#LimpiarCliente').on('click', limpiarCamposCliente)
    $('#FrmCliente').on('submit', enviarAsignarCliente)
}

function addEventCloseWindow(element) {
    $('.window__close').on('click', function (e) { element.find('.window').remove() })
}

async function buscarCliente() {
    let cedula = $('#TxtCedula').val().trim()
    if (!cedula) {
        alert('Ingresar cédula para buscar cliente.')
        return
    }
    let response = await getResourcesApi(`${CLIENTES}/${cedula}`, {
        method: "GET",
        headers: {
            Authorization: getAuthorization()
        }
    })
    if (response.error) {
        await renderizarLogin()
        return
    }
    let data = await response.json()
    let cliente = data.datos
    if (!cliente) {
        alert(data.mensaje)
        limpiarCamposCliente(false)
        $('#AsignarCliente').prop('disabled', false)
        $('#AsignarCliente').text('Crear y Asignar')
        return
    }
    $('#HidCrear').val(false)
    $('#HidId').val(cliente.id)
    $('#HidEstado').val(cliente.estado)
    $('#AsignarCliente').prop('disabled', false)
    $('#TxtNombre').val(cliente.nombre)
    $('#TxtDireccion').val(cliente.direccion)
    $('#TxtTelefono').val(cliente.telefono)
    $('#TxtCorreo').val(cliente.correo)
}

function limpiarCamposCliente(limpiarCedula = true) {
    $('#HidCrear').val(true)
    $('#HidId').val(0)
    $('#HidEstado').val(0)
    $('#AsignarCliente').prop('disabled', true)
    if (limpiarCedula) $('#TxtCedula').val('')
    $('#TxtNombre').val('')
    $('#TxtDireccion').val('')
    $('#TxtTelefono').val('')
    $('#TxtCorreo').val('')
}

async function enviarAsignarCliente(event) {
    event.preventDefault()
    const formData = new FormData(event.target)
    let cliente = {
        id: +formData.get('id'),
        nombre: formData.get('nombre'),
        cedula: formData.get('cedula'),
        direccion: formData.get('direccion'),
        telefono: formData.get('telefono'),
        correo: formData.get('correo'),
        estado: +formData.get('estado')
    }
    let crear = formData.get('crear') == "true"
    let response
    if (crear) {
        response = await getResourcesApi(CREAR_CLIENTE, {
            method: "POST",
            headers: {
                Authorization: getAuthorization(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify(cliente)
        })
    }
    else {
        response = await getResourcesApi(`${ACTUALIZAR_CLIENTE}/${cliente.cedula}`, {
            method: "PUT",
            headers: {
                Authorization: getAuthorization(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify(cliente)
        })
    }
    if (response.error) {
        await renderizarLogin()
        return
    }
    let data = await response.json()
    if (!data.datos && response.status !== 200)
        alert(data.mensaje)
    if (response.status === 201) {
        let clienteId = data.datos.id
        cliente.id = clienteId
    }
    let cuenta = obtenerCuenta()
    cuenta.clienteId = cliente.id
    cuenta.clienteNombre = cliente.nombre
    cuenta.clienteCedula = cliente.cedula
    setCheck(cuenta)
    $('#HidId').val(cuenta.clienteId)
    renderizarDatosCliente(cuenta)

    $('.window__close').click()
}

function renderizarDatosCliente(cuenta) {
    $('#NombreCliente').text(cuenta.clienteNombre ?? "Consumidor Final")
    $('#CedulaCliente').text(cuenta.clienteCedula ?? "9999999999")
}

async function procesarPago(event) {
    let cuenta = obtenerCuenta()
    let subtotal = cuenta.detalles.reduce((acumulador, current) => {
        return acumulador + current.total
    }, 0)
    if (subtotal == 0) {
        alert('No se puede cerrar la cuenta con totales en 0.')
        return;
    }

    cuenta.detalles.push({
        tipo: 1,
        articuloId: null,
        cantidad: 1,
        total: cuenta.total
    })

    let response = await getResourcesApi(PROCESAR_CUENTA, {
        method: "POST",
        headers: {
            Authorization: getAuthorization(),
            "Content-Type": "application/json"
        },
        body: JSON.stringify(cuenta)
    })
    if (response.error) {
        await renderizarLogin()
        return
    }
    let data = await response.json()
    removeCheck()
    alert(data.mensaje)
}

async function cancelarCuenta(event) {
    removeCheck()
}

async function moduloFunciones(event) {
    let elementBody = $('body')
    let elementWindow = elementBody.find('.window')
    if (elementWindow.length !== 0) return;
    let component = await getResources('funciones.html', { method: "GET" })
    elementBody.append($(await component.text()))
    addEventCloseWindow(elementBody)
    $('#BtnArticulos').on('click', moduloArticulo)
    $('#BtnReportes').on('click', moduloReporte)
    $('#BtnSalir').on('click', salir)
}

async function moduloArticulo(event) {
    let elementBody = $('body')
    let elementWindow = elementBody.find('.window')
    if (elementWindow.length !== 0) {
        $('.window__close').click()
    }
    let component = await getResources('articulo.html', { method: "GET" })
    elementBody.append($(await component.text()))
    addEventCloseWindow(elementBody)

    let table = $('#TblArticulos').DataTable({
        ajax: {
            url: ARTICULOS,
            type: 'GET',
            headers: {
                Authorization: getAuthorization()
            },
            dataSrc: 'datos'
        },
        columns: [
            {
                title: 'Código',
                data: 'codigo'
            },
            {
                title: 'Nombre',
                data: 'nombre'
            },
            {
                title: 'Precio',
                data: 'precio'
            },
            {
                title: 'Stock',
                data: 'stock'
            },
            {
                title: 'Estado',
                data: 'estado'
            }
        ]
    })
    table.on('click', 'tbody tr', (e) => {
        let classList = e.currentTarget.classList;
        if (classList.contains('selected')) {
            classList.remove('selected');
            limpiarCamposArticulo()
        } else {
            table.rows('.selected').nodes().each((row) => row.classList.remove('selected'));
            classList.add('selected');
            let articulo = table.rows('.selected').data()['0']
            $('#HidCrear').val(false)
            $('#HidId').val(articulo.id)
            $('#HidEstado').val(articulo.estado)
            $('#TxtCodigo').val(articulo.codigo)
            $('#TxtNombre').val(articulo.nombre)
            $('#TxtMaterial').val(articulo.material)
            $('#TxtDurabilidad').val(articulo.durabilidad)
            $('#TxtPeso').val(articulo.peso)
            $('#TxtTamanio').val(articulo.tamanio)
            $('#TxtPrecio').val(articulo.precio)
            $('#TxtStock').val(articulo.stock)

            $('#EliminarArticulo').prop('disabled', false)
            $('#BajaArticulo').prop('disabled', false)

            let fileInput = document.getElementById('InpImagenes')
            const dataTransfer = new DataTransfer();
            $.each(articulo.imagenes, (index, imagen) => {
                let file = dataURLtoFile(`data:image/webp;base64,${imagen.imagenBase64}`, `${articulo.nombre}${imagen.id}.png`);
                dataTransfer.items.add(file);
            })
            fileInput.files = dataTransfer.files;
            $('#InpImagenes').data('ids', JSON.stringify(articulo.imagenes.map(articulo => articulo.id)))
        }
    });
    $('#LimpiarArticulo').on('click', function () {
        limpiarCamposArticulo()
        table.ajax.reload()
    })
    $('#EliminarArticulo').on('click', async function(event) {
        await eliminarArticulo(event)
        limpiarCamposArticulo()
        table.ajax.reload()
    })
    $('#BajaArticulo').on('click', async function(event) {
        await bajaArticulo(event)
        limpiarCamposArticulo()
        table.ajax.reload()
    })
    $('#FrmArticulo').on('submit', async function (event) {
        await guardarArticulo(event)
        table.ajax.reload()
    })
}

async function eliminarArticulo(event) {
    let id = $('#HidId').val()
    let response = await getResourcesApi(`${ELIMINAR_ARTICULO}/${id}`, {
        method: "DELETE",
        headers: {
            Authorization: getAuthorization()
        }
    })
    if (response.error) {
        await renderizarLogin()
        return
    }
    let data = await response.json()
    alert(data.mensaje)

    renderizarVentas()
}

async function bajaArticulo(event) {
    let codigo = $('#TxtCodigo').val()
    let response = await getResourcesApi(`${BAJA_ARTICULO}/${codigo}`, {
        method: "PUT",
        headers: {
            Authorization: getAuthorization()
        }
    })
    if (response.error) {
        await renderizarLogin()
        return
    }
    let data = await response.json()
    if (!data.datos && response.status !== 200)
        alert(data.mensaje)

    renderizarVentas()
}

async function guardarArticulo(event) {
    event.preventDefault()
    const formData = new FormData(event.target)
    let articulo = {
        id: +formData.get('id'),
        codigo: +formData.get('codigo'),
        nombre: formData.get('nombre'),
        material: +formData.get('material'),
        durabilidad: formData.get('durabilidad'),
        peso: +formData.get('peso'),
        tamanio: formData.get('tamanio'),
        precio: +formData.get('precio'),
        stock: +formData.get('stock'),
        estado: +formData.get('estado'),
        imagenes: []
    }
    let files = $('#InpImagenes').prop('files')
    if (files.length === 0) {
        alert('Debe de subir al menos 1 imagen.')
        return
    }
    let dataIds = $('#InpImagenes').data('ids');
    let ids = dataIds ? dataIds.replace('[', '').replace(']', '') : ""
    let arrIds = ids.split(',')
    for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const base64 = await convertBase64(file)
        const arr = base64.split(',')
        const id = arrIds[index] ? arrIds[index] : null
        articulo.imagenes.push({ id: id, imagenBase64: arr[arr.length - 1] })
    }
    let crear = formData.get('crear') == "true"
    let response
    if (crear) {
        response = await getResourcesApi(CREAR_ARTICULO, {
            method: "POST",
            headers: {
                Authorization: getAuthorization(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify(articulo)
        })
    }
    else {
        response = await getResourcesApi(`${ACTUALIZAR_ARTICULO}/${articulo.id}`, {
            method: "PUT",
            headers: {
                Authorization: getAuthorization(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify(articulo)
        })
    }
    if (response.error) {
        await renderizarLogin()
        return
    }
    let data = await response.json()
    if (!data.datos && response.status !== 200)
        alert(data.mensaje)

    renderizarVentas()

    // $('.window__close').click()
}

function convertBase64(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.readAsDataURL(file);

        fileReader.onload = () => {
            resolve(fileReader.result);
        };

        fileReader.onerror = (error) => {
            reject(error);
        };
    });
};

function dataURLtoFile(dataurl, filename) {
    var arr = dataurl.split(','),
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[arr.length - 1]),
        n = bstr.length,
        u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

function limpiarCamposArticulo() {
    $('#HidCrear').val(true)
    $('#HidId').val(0)
    $('#HidEstado').val(0)
    $('#TxtCodigo').val('')
    $('#TxtNombre').val('')
    $('#TxtMaterial').val('')
    $('#TxtDurabilidad').val('')
    $('#TxtPeso').val('')
    $('#TxtTamanio').val('')
    $('#TxtPrecio').val('')
    $('#TxtStock').val('')
    $("#InpImagenes").data('ids', '')
    $("#InpImagenes").val('').change()

    $('#EliminarArticulo').prop('disabled', true)
    $('#BajaArticulo').prop('disabled', true)
}

async function moduloReporte(event) {
    let elementBody = $('body')
    let elementWindow = elementBody.find('.window')
    if (elementWindow.length !== 0) {
        $('.window__close').click()
    }
    let component = await getResources('reporte.html', { method: "GET" })
    elementBody.append($(await component.text()))
    addEventCloseWindow(elementBody)
    $('#BtnReporteVentas').on('click', reporteVentas)
    $('#BtnReporteArticulos').on('click', reporteArticulos)
}

async function reporteVentas(event) {
    let elementBody = $('body')
    let elementWindow = elementBody.find('.window')
    if (elementWindow.length !== 0) {
        $('.window__close').click()
    }
    let component = await getResources('reporteVentas.html', { method: "GET" })
    elementBody.append($(await component.text()))
    addEventCloseWindow(elementBody)

    const date = new Date();
    date.setDate(date.getDate() - 1);
    let currentDate = date.toJSON().split('T')[0]
    $('#DatFechaInicio').val(currentDate)
    $('#DatFechaFinal').val(currentDate)

    $('#FrmReporteVentas').on('submit', buscarVentas)
}

async function reporteArticulos(event) {
    let elementBody = $('body')
    let elementWindow = elementBody.find('.window')
    if (elementWindow.length !== 0) {
        $('.window__close').click()
    }
    let component = await getResources('reporteArticulos.html', { method: "GET" })
    elementBody.append($(await component.text()))
    addEventCloseWindow(elementBody)

    $('#TblArticulos').DataTable({
        dom: 'Blfrtip',
        buttons: [
            {
                extend: 'pdf',
                text: 'Exportar',
                exportOptions: {
                    modifier: {
                        page: 'current'
                    }
                }
            }
        ],
        ajax: {
            url: REPORTE_ARTICULOS,
            type: 'GET',
            headers: {
                Authorization: getAuthorization()
            },
            dataSrc: 'datos'
        },
        columns: [
            {
                title: 'Codigo',
                data: 'codigo'
            },
            {
                title: 'Nombre',
                data: 'nombre'
            },
            {
                title: 'Precio',
                data: 'precio'
            },
            {
                title: 'Stock',
                data: 'stock'
            },
            {
                title: 'Estado',
                data: 'estadoString'
            }
        ]
    })
}

async function buscarVentas(event) {
    event.preventDefault()
    const formData = new FormData(event.target)
    let response = await getResourcesApi(CUENTAS, {
        method: "POST",
        headers: {
            Authorization: getAuthorization(),
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            filtrarFechas: formData.get('filtrarFechas') === 'on',
            fechaInicio: formData.get('fechaInicio'),
            fechaFinal: formData.get('fechaFinal')
        })
    })
    if (response.error) {
        await renderizarLogin()
        return
    }
    let data = await response.json()

    if (tableReporteVentas instanceof jQuery.fn.dataTable.Api) {
        tableReporteVentas.destroy()
    }

    tableReporteVentas = $('#TblVentas').DataTable({
        dom: 'Blfrtip',
        buttons: [
            {
                extend: 'pdf',
                text: 'Exportar',
                exportOptions: {
                    modifier: {
                        page: 'current'
                    }
                }
            }
        ],
        data: data.datos,
        columns: [
            {
                title: 'Cliente',
                data: 'clienteCedula'
            },
            {
                title: 'Fecha Emisión',
                data: 'fechaEmision'
            },
            {
                title: 'Subtotal',
                data: 'subtotal'
            },
            {
                title: 'Impuestos',
                data: 'impuestos'
            },
            {
                title: 'Total',
                data: 'total'
            }
        ]
    })
}

function decodeJWT(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

async function getResourcesApi(url, request) {
    let response = await getResources(url, request)
        .then(response => response)
        .catch(error => { return { error } })
    return response
}

async function getResources(url, request) {
    let response = await fetch(url, request)
    return response
}

function getAuthorization() {
    let token = window.localStorage.getItem("token-site")
    return `Bearer ${token}`
}

function iniciarCuenta() {
    let cuenta = {
        detalles: [],
        subtotal: 0,
        impuestos: 0,
        total: 0,
        porcentajeImpuesto: 0.12
    }
    setCheck(cuenta)
    return cuenta
}

function obtenerCuenta() {
    let cuenta = getCheck()
    if (!cuenta) cuenta = iniciarCuenta()
    return cuenta
}

function obtenerDetalle(cuenta, articuloId) {
    return cuenta.detalles.filter(detalle => detalle.articuloId === articuloId)[0]
}

function eliminarDetalle(articuloId) {
    let cuenta = obtenerCuenta()
    cuenta.detalles = cuenta.detalles.filter(detalle => detalle.articuloId !== articuloId)
    setCheck(cuenta)
    renderizarDetallesCuenta(cuenta)
}

function setCheck(cuenta) {
    sessionStorage.setItem('cuenta', JSON.stringify(cuenta))
}

function getCheck() {
    let cuenta = sessionStorage.getItem('cuenta')
    return JSON.parse(cuenta)
}

function removeCheck() {
    sessionStorage.removeItem('cuenta')
    let cuenta = obtenerCuenta()
    renderizarDetallesCuenta(cuenta)
}

async function salir() {
    window.localStorage.removeItem("token-site")
    await renderizarLogin()
    $('.window__close').click()
}

async function moduloArticuloCliente(event) {
    let elementBody = $('body')
    let elementWindow = elementBody.find('.window')
    if (elementWindow.length !== 0) {
        $('.window__close').click()
    }
    let component = await getResources('articulo-cliente.html', { method: "GET" })
    elementBody.append($(await component.text()))
    addEventCloseWindow(elementBody)

    $('#TblArticulos').DataTable({
        ajax: {
            url: ARTICULOS,
            type: 'GET',
            headers: {
                Authorization: getAuthorization()
            },
            dataSrc: 'datos'
        },
        columns: [
            {
                title: 'Nombre',
                data: 'nombre'
            },
            {
                title: 'Precio',
                data: 'precio'
            },
            {
                title: 'Stock',
                data: 'stock'
            }
        ]
    })
}

async function moduloComprasCliente(event) {
    let elementBody = $('body')
    let elementWindow = elementBody.find('.window')
    if (elementWindow.length !== 0) {
        $('.window__close').click()
    }
    let component = await getResources('compras-usuario.html', { method: "GET" })
    elementBody.append($(await component.text()))
    addEventCloseWindow(elementBody)

    $('#TblVentas').DataTable({
        dom: 'Blfrtip',
        buttons: [
            {
                extend: 'pdf',
                text: 'Exportar',
                exportOptions: {
                    modifier: {
                        page: 'current'
                    }
                }
            }
        ],
        ajax: {
            url: CUENTAS_CLIENTE,
            type: 'GET',
            headers: {
                Authorization: getAuthorization()
            },
            dataSrc: 'datos'
        },
        columns: [
            {
                title: 'Fecha Emisión',
                data: 'fechaEmision'
            },
            {
                title: 'Subtotal',
                data: 'subtotal'
            },
            {
                title: 'Impuestos',
                data: 'impuestos'
            },
            {
                title: 'Total',
                data: 'total'
            }
        ]
    })
}