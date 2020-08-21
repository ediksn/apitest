const http = require('http')
const bodyParser = require('body-parser')
const cors = require('cors')
const expres = require('express')
const rp = require('request-promise')
const api = require('./api')
const fs = require('fs')

const port = process.env.PORT || 9090
const app = expres()
const server = http.createServer(app)

app.use(bodyParser.json({limit: '50mb'}))
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }))
app.use(cors())

function handleError(err, res){
    /*
    * Toma el error que recibe por parametro y lo manda en la respuesta 
    */
    res.status(500).json({
        err,
        message:'failed'
    })
}

async function queryApis(){
    /*
    * Consulta todas las APIs con los diferentes valores 
    * asigna los valores a una archivo JSON local
    */
    try {
        const coins = JSON.parse(await rp(`${api.gecko}`))
        const tasas = JSON.parse(await rp(`${api.dolartoday}`))
        const petro = JSON.parse(await rp(`${api.petro}`,
            {
                method:'POST', 
                headers:{'Content-Type':'application/json'}, 
                body:JSON.stringify({coins:['PTR'],fiats:['USD']})
            }
        )).data.PTR.USD
        const btc = coins.filter(el => el.id === 'bitcoin')[0].current_price
        const eth = coins.filter(el => el.id === 'ethereum')[0].current_price
        const dash = coins.filter(el => el.id === 'dash')[0].current_price
        const usd = tasas.USD.promedio
        const eur = tasas.EUR.promedio
        fs.writeFileSync('data.json', JSON.stringify({ 
            usd,
            eur,
            petro,
            btc,
            eth,
            dash
        }))
    } catch (error) {
        throw new Error(error)
    }
}


app.get('/change/:coin/:amount', async(req, res) => {
    /*
    * Recibe una moneda y devuelve el valor en base  
    * a las demas monedas
    */
    const amount = req.params.amount
    const coin = req.params.coin
    try {
        const data = JSON.parse(fs.readFileSync('data.json'))
        if(!data[coin]){
            res.status(404).json({message:'not found', error: 'No existe esa moneda'})
        }else{
            switch(coin){
                case 'usd':
                    res.status(200).json({message:'success',data:{
                        eur: (data['usd'] / data['eur'])*amount,
                        petro: amount / data['petro'],
                        btc: amount / data['btc'],
                        eth: amount / data['eth'],
                        dash: amount / data['dash'],
                        bs: amount * data['usd']
                    }})
                    break
                case 'eur':
                    res.status(200).json({message:'success',data:{
                        usd: amount / (data['usd'] / data['eur']),
                        petro: amount / (data['petro']*(data['usd'] / data['eur'])),
                        btc: amount / (data['btc']*(data['usd'] / data['eur'])),
                        eth: amount /(data['eht']*(data['usd'] / data['eur'])),
                        dash: amount / (data['dash']*(data['usd'] / data['eur'])),
                        bs: amount / (data['eur'])
                    }})
                    break
                case 'petro':
                    res.status(200).json({message:'success',data:{
                        usd: amount * (data['petro']),
                        eur: amount * (data['petro']*(data['usd'] / data['eur'])),
                        btc: amount * (data['petro']/data['btc']),
                        eth: amount * (data['petro']/data['eth']),
                        dash: amount * (data['petro']/data['dash']),
                        bs: amount * (data['petro']*data['usd'])
                    }})
                    break
                case 'btc':
                    res.status(200).json({message:'success',data:{
                        usd: amount * data['btc'],
                        eur: amount * data['btc'] *(data['usd'] / data['eur']),
                        petro: amount * (data['btc']/data['petro']),
                        eth: amount * (data['btc']/data['eth']),
                        dash: amount * (data['btc'] / data['dash']),
                        bs: data['btc']*data['usd']
                    }})
                    break
                case 'eth':
                    res.status(200).json({message:'success',data:{
                        usd: amount * data['eth'],
                        eur: amount * data['eth'] * (data['usd'] / data['eur']),
                        petro: amount * (data['eth']/data['petro']),
                        btc: amount * (data['eth']/data['btc']),
                        dash: amount * (data['eth']/data['dash']),
                        bs: data['eth']*data['usd']
                    }})
                    break
                case 'dash':
                    res.status(200).json({message:'success',data:{
                        usd: amount * data['dash'],
                        eur: amount * data['dash'] * (data['usd'] / data['eur']),
                        petro: amount * (data['dash']/data['petro']),
                        btc: amount * (data['dash']/data['btc']),
                        eth: amount * (data['dash']/data['eth']),
                        bs: data['dash']*data['usd']
                    }})
                    break
                case 'bs':
                    res.status(200).json({message:'success',data:{
                        usd: amount * data['usd'],
                        eur: amount * (data['eur']),
                        petro: amount * (data['petro'] * data['usd']),
                        btc: amount * (data['btc'] * data['usd']),
                        eth: amount * (data['eth'] * data['usd']),
                        dash: amount * (data['dash'] * data['usd'])
                    }})
                    break
            }
        }
    } catch (error) {
        handleError(error, res)
    }
})

app.post('coin', async(req, res) => {
    /*
    *   Recibe una moneda y actualiza su valor
    */
    const coin = req.body.coin
    const amount = req.body.amount
    let data = JSON.parse(fs.readFileSync('data.json'))
    try {
      data['coin'] = amount
      fs.writeFileSync('data.json', JSON.stringify(data))  
    } catch (error) {
        handleError(error, res)
    }
})

app.get('', async(req, res) => {
    /*
    * Retorna todas las monedas con su valor en USD
    */
    try {
        const data = JSON.parse(fs.readFileSync('data.json'))
        res.status(200).json({
            message:'success',
            data
        })
    } catch (error) {
        handleError(error, res)
    }
})


function handleFatalError(err) {
    /*
    * Maneja los errores uncaughtException y undhandledException
    */
    console.log(err.stack)
    process.on("exit", function () {
        require("child_process").spawn(process.argv.shift(), process.argv, {
            cwd: process.cwd(),
            detached : true,
            stdio: "inherit"
        });
    });
    process.exit();
}

 function start() {
     /*
     * Funcion que ejecuta el servidor API en una url local 
     */
    process.on('uncaughtException', handleFatalError)
    process.on('unhandledRejection', handleFatalError)
    server.listen(port, '0.0.0.0', async () => {
        await queryApis()
        console.log('Servidor funcionando en el puerto '+port)
    })
}

start()