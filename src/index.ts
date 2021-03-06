import * as akala from '@akala/server';
import * as upnp from './upnp'
import { URL } from 'url'
import * as ssdp from 'ssdp-ts';
import * as dgram from 'dgram'
import { EventEmitter } from 'events'
import * as sd from '@domojs/service-discovery'
export { Service } from './upnp';

akala.injectWithName(['$isModule', '$worker'], function (isModule: akala.worker.IsModule, worker: EventEmitter)
{
    if (isModule('@domojs/upnp'))
    {
        var devices: { [key: string]: NodeJS.Timer } = {};

        worker.on('ready', function ()
        {
            akala.worker.createClient('api/zeroconf').then(function (c)
            {
                var server = akala.api.jsonrpcws(sd.meta).createServerProxy(c);
                var http: akala.Http = akala.resolve('$http');
                var handle = function (headers: ssdp.Headers, rinfo: dgram.RemoteInfo)
                {
                    akala.logger.info(headers);
                    var services: upnp.Service[] = [];
                    function removeDevice()
                    {
                        akala.each(services, function (service)
                        {
                            server.delete(service);
                        });
                    }
                    if (!devices[headers.USN])
                    {
                        devices[headers.USN] = setTimeout(removeDevice, Number(headers['CACHE-CONTROL'].substring('max-age='.length)) * 1000);
                        http.getXML(headers.LOCATION).then(function (xml)
                        {
                            akala.each(xml.root.device, function (device)
                            {
                                var icons = {};
                                if (device.iconList && device.iconList[0] && device.iconList[0].icon)
                                    akala.each(device.iconList[0].icon, function (icon)
                                    {
                                        icons[icon.width] = new URL(icon.url[0], headers.LOCATION);
                                    })

                                if (device.serviceList && device.serviceList.length > 0)
                                    akala.each(device.serviceList[0].service, function (svc)
                                    {

                                        var service: upnp.Service = {
                                            name: device.friendlyName[0],
                                            icons: icons,
                                            type: svc.serviceType[0],
                                            descriptor: {
                                                scpd: svc.SCPDURL[0],
                                                control: svc.controlURL[0],
                                                event: svc.eventSubURL[0]
                                            },
                                            headers: headers
                                        };
                                        if (service.type == headers.ST)
                                        {
                                            services.push(service);
                                            server.add(service);
                                        }
                                    });
                                else
                                {
                                    var service: upnp.Service = {
                                        name: device.friendlyName[0],
                                        type: headers.ST,
                                        descriptor: {
                                            scpd: null,
                                            control: null,
                                            event: null
                                        },
                                        icons: icons,
                                        headers: headers
                                    };
                                    services.push(service);
                                    server.add(service);
                                }
                            });
                        });
                    }
                };

                client.on('response', handle);
                client.on(ssdp.Const.ADVERTISE_ALIVE, handle);
            });

            var client = new ssdp.Client();
            client.start(function (err)
            {
                if (err)
                    akala.logger.error(err);

            });

            client.search('ssdp:all');
        })
    }
})();

