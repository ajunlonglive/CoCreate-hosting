const CoCreateCrud = require('@cocreate/crud-client')
const mime = require('mime-types')

const fs = require('fs');
const path = require('path');
let config;

let jsConfig = path.resolve(process.cwd(), 'CoCreate.config.js');
if (fs.existsSync(jsConfig))
	config = require(jsConfig);
else {
	console.log('config not found.')
	process.exit()
}

const { crud, sources, config : socketConfig } = config;

// ToDo: throwing error
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0

CoCreateCrud.socket.create({
	organization_id: socketConfig.organization_id,
	apiKey: socketConfig.apiKey,
	host: socketConfig.host
})

const commonParam = {
	apiKey: socketConfig.apiKey,
	organization_id: socketConfig.organization_id,
	host: socketConfig.host,
	broadcast: false
}

async function runStore (info, type) {
	try {
		let response = false;
		if (!info.document_id) {
			response = await CoCreateCrud.createDocument({
				...commonParam,
				...info,
			})
		} else {
			response = await  CoCreateCrud.updateDocument({
				...commonParam,
				...info,
				upsert: true
			})
		}
		if (response) {
			return response;
		}
	} catch (err) {
		console.log(err);
		return null;
	}
} 

/**
 * update and create document by config crud
 */

if (crud) {
	crud.forEach(async (info) => {
		await runStore(info, 'crud')
	})
}

/**
 * Store html files by config sources
 **/
if (sources) {
	let new_sources_list = [];

	async function runSources() {
		for (let i = 0; i < sources.length; i++) {
			const { entry, collection, document_id, key, data } = sources[i];
			
			let new_source = {...sources[i]};
			let response = {};
			if (entry) {
				
				try {
					let read_type = 'utf8'
					let mime_type = mime.lookup(entry) || 'text/html';
					if (/^(image|audio|video)\/[-+.\w]+/.test(mime_type)) {
						read_type = 'base64'
					}
					
					let binary = fs.readFileSync(entry);
					
					let content = new Buffer.from(binary).toString(read_type);

					if (content && key && collection) {
						if (!data) data = {};
						let storeData = {
							[key]: content,
							...data,
						};
						
						response = await runStore({collection, document_id, data: storeData}, 'sources');
					}
				} catch (err) {
					console.log(err)
				}
				if (response.document_id) {
					new_source.document_id = response.document_id
				}
			}
			new_sources_list.push(new_source)
		}
		return new_sources_list

	}
	
	runSources().then((data) => {
		let new_config = {
			config: socketConfig,
			sources: new_sources_list,
			crud: crud,
		}
		
		let write_str = JSON.stringify(new_config, null, 4)
		write_str = "module.exports = " + write_str;

		fs.writeFileSync(jsConfig, write_str);
		setTimeout(function(){
			process.exit()
		}, 2000)		
	})
}


