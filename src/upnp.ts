import * as sd from '@domojs/service-discovery'
import * as akala from '@akala/server';



export interface Service extends sd.Service
{
    name: string;
    descriptor: {
        scpd: string,
        control: string,
        event: string
    };
    headers: { [key: string]: string | number }
}