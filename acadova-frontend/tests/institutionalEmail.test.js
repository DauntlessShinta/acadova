import test from 'node:test';
import assert from 'node:assert/strict';
import { isInstitutionalEmail, validateRegistration } from '../src/utils/authForm.js';
test('institutional frontend guidance matches the exact configured backend domain policy',()=>{
 const domains=['phinmaed.com'];
 assert.equal(isInstitutionalEmail('  Student.One@PHINMAED.COM ',domains),true);
 for(const email of ['a@gmail.com','a@yahoo.com','a@outlook.com','a@sub.phinmaed.com','a@phinmaed.com.evil.test','a@evilphinmaed.com','a+alias@phinmaed.com','a..b@phinmaed.com','a@phіnmaed.com']) assert.equal(isInstitutionalEmail(email,domains),false,email);
 const input={name:'Student One',email:' STUDENT.ONE@PHINMAED.COM ',password:'Password1!',confirmPassword:'Password1!',policyAccepted:true,allowedDomains:domains};
 assert.deepEqual(validateRegistration(input).fields,{});assert.equal(validateRegistration(input).account.email,'student.one@phinmaed.com');
 assert.ok(validateRegistration({...input,email:'a@gmail.com'}).fields.email);
 assert.ok(validateRegistration({...input,password:'short'}).fields.password);
 assert.ok(validateRegistration({...input,policyAccepted:false}).fields.policyAccepted);
});
