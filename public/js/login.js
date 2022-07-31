import axios from 'axios';
import { showAlert } from './alert';

export const login = async (email, password) => {
    try{
        const result = await axios({
            method: 'POST',
            url: 'http://127.0.0.1:3000/api/v1/users/login',
            data: {
                email,
                password
            }
        });

        if(result.data.status === 'success'){
            showAlert('success','Logged in successfully!');
            window.setTimeout(()=> {
                location.assign('/');
            }, 1500);
        }
    } catch(err){
        showAlert('error', err.response.data.message);
    }
};

export const logout = async () => {
    try{
        console.log('entered logout function');
        const result = await axios({
            method: 'GET',
            url: 'http://127.0.0.1:3000/api/v1/users/logout'
        });
        if(result.data.status === 'success') location.assign('/');     // true will force a reload from the server and not from browser cache
    } catch(err){
        showAlert('error', 'Error logging out! Try again.')
    }
};