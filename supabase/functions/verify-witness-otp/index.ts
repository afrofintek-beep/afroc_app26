import {handleWitness} from '../_shared/witness-confirmation.ts';
Deno.serve((request:Request)=>handleWitness(request,Deno.env,fetch,'verify'));
