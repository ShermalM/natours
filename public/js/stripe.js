import axios from 'axios';
import { showAlert } from './alert';

export const bookTour = async tourID => {
    try{
        const stripe = Stripe('pk_test_51LQYhdCt7FQuxYr5qfe0kBXNn8c7KgeS3w8ml9ChiFlrmDWnqZM1Yt23SvpVpkSrXHhXwnhutXrSgwmblFeVm3dF00Bu7pkN2E');
        // 1) Get checkout session from API endpoint
        const session = await axios(`/api/v1/bookings/checkout-session/${tourID}`);

        // 2) Create checkout form + charge the credit card
        await stripe.redirectToCheckout({
            sessionId: session.data.session.id
        });

    } catch(err){
        console.log(err);
        showAlert('error', err);
    }
    
};